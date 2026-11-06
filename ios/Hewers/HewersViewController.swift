import UIKit
import WebKit

private final class ExportHandler: NSObject, WKScriptMessageHandler {
    weak var owner: HewersViewController?
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.receiveExport(message)
    }
}

final class HewersViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var webView: WKWebView!
    private let progress = UIProgressView(progressViewStyle: .bar)
    private let errorPanel = UIStackView()
    private var observations: [NSKeyValueObservation] = []
    private let exportHandler = ExportHandler()
    private var downloads: [ObjectIdentifier: URL] = [:]
    private var exporting = false
    private let navy = UIColor(red: 0, green: 36/255, blue: 72/255, alpha: 1)
    private let gold = UIColor(red: 244/255, green: 171/255, blue: 2/255, alpha: 1)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = navy
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .audio
        configuration.applicationNameForUserAgent = "HewersiOS/0.1.0"
        exportHandler.owner = self
        configuration.userContentController.add(exportHandler, name: "hewersDownload")
        configuration.userContentController.addUserScript(WKUserScript(source: """
        if (location.origin === 'https://hewers-system.vercel.app' && window === window.top) {
          Object.defineProperty(window, 'HewersDownloads', { value: Object.freeze({
            postMessage: function(message) { window.webkit.messageHandlers.hewersDownload.postMessage(message); }
          }), writable: false, configurable: false });
        }
        """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.accessibilityIdentifier = "hewers-webview"
        if #available(iOS 16.4, *) {
            #if DEBUG
            webView.isInspectable = true
            #endif
        }
        let toolbar = UIToolbar()
        toolbar.tintColor = navy
        let back = UIBarButtonItem(image: UIImage(systemName: "chevron.backward"), style: .plain, target: self, action: #selector(goBack))
        back.accessibilityLabel = "Back"
        let title = UIBarButtonItem(title: "Hewers", style: .plain, target: nil, action: nil)
        title.isEnabled = false
        let reload = UIBarButtonItem(barButtonSystemItem: .refresh, target: self, action: #selector(retry))
        reload.accessibilityLabel = "Reload Hewers"
        let browser = UIBarButtonItem(image: UIImage(systemName: "safari"), style: .plain, target: self, action: #selector(openInSafari))
        browser.accessibilityLabel = "Open Hewers in Safari"
        toolbar.items = [back, .flexibleSpace(), title, .flexibleSpace(), reload, browser]
        for child in [toolbar, webView!, progress] { child.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(child) }
        progress.progressTintColor = gold
        NSLayoutConstraint.activate([
            toolbar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor), toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: toolbar.bottomAnchor), webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor), webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor), webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            progress.topAnchor.constraint(equalTo: webView.topAnchor), progress.leadingAnchor.constraint(equalTo: webView.leadingAnchor), progress.trailingAnchor.constraint(equalTo: webView.trailingAnchor)
        ])
        configureErrorPanel()
        observations = [
            webView.observe(\.estimatedProgress, options: .new) { [weak self] web, _ in self?.progress.setProgress(Float(web.estimatedProgress), animated: true) },
            webView.observe(\.isLoading, options: .new) { [weak self] web, _ in self?.progress.isHidden = !web.isLoading },
            webView.observe(\.canGoBack, options: .new) { web, _ in back.isEnabled = web.canGoBack }
        ]
        back.isEnabled = false
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-hewers-ui-test") {
            webView.loadHTMLString("""
            <!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:20px -apple-system;padding:32px;color:#002448"><h1>Hewers iPhone preview</h1><p>Isolated interface fixture. No live records or camera capture.</p><label>Worker search <input aria-label="Worker search" placeholder="Select a worker"></label></body></html>
            """, baseURL: nil)
            return
        }
        #endif
        webView.load(URLRequest(url: AppPolicy.home))
    }

    private func configureErrorPanel() {
        errorPanel.axis = .vertical; errorPanel.alignment = .center; errorPanel.spacing = 18
        errorPanel.backgroundColor = .systemBackground
        errorPanel.isLayoutMarginsRelativeArrangement = true
        errorPanel.layoutMargins = UIEdgeInsets(top: 35, left: 24, bottom: 35, right: 24)
        let title = UILabel(); title.text = "Unable to connect"; title.font = .preferredFont(forTextStyle: .title2); title.textColor = navy
        let message = UILabel(); message.text = "Check your internet connection, then try again. Saved drafts remain on this device."; message.numberOfLines = 0; message.textAlignment = .center
        let retry = UIButton(type: .system); retry.setTitle("Try again", for: .normal); retry.titleLabel?.font = .preferredFont(forTextStyle: .headline); retry.addTarget(self, action: #selector(self.retry), for: .touchUpInside)
        for child in [title, message, retry] { errorPanel.addArrangedSubview(child) }
        errorPanel.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(errorPanel)
        NSLayoutConstraint.activate([errorPanel.leadingAnchor.constraint(equalTo: webView.leadingAnchor), errorPanel.trailingAnchor.constraint(equalTo: webView.trailingAnchor), errorPanel.centerYAnchor.constraint(equalTo: webView.centerYAnchor)])
        errorPanel.isHidden = true; errorPanel.accessibilityIdentifier = "connection-error"
    }

    @objc private func goBack() { if webView.canGoBack { webView.goBack() } }
    @objc private func retry() {
        errorPanel.isHidden = true
        if AppPolicy.isTrusted(webView.url) { webView.reload() } else { webView.load(URLRequest(url: AppPolicy.home)) }
    }
    @objc private func openInSafari() { UIApplication.shared.open(AppPolicy.isTrusted(webView.url) ? webView.url! : AppPolicy.home) }
    private func alert(_ message: String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title: "Hewers", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default)); present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-hewers-ui-test"), url.absoluteString == "about:blank" { decisionHandler(.allow); return }
        #endif
        if action.targetFrame?.isMainFrame == false { decisionHandler(.cancel); return }
        if AppPolicy.isTrusted(url) {
            decisionHandler(action.shouldPerformDownload ? .download : .allow); return
        }
        if AppPolicy.isTrustedBlob(url), AppPolicy.isTrusted(webView.url), action.shouldPerformDownload { decisionHandler(.download); return }
        if AppPolicy.isExternalHTTPS(url), AppPolicy.isTrusted(webView.url), action.navigationType == .linkActivated || action.targetFrame == nil {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, AppPolicy.isTrusted(url) { webView.load(action.request) }
        else if let url = action.request.url, AppPolicy.isExternalHTTPS(url), AppPolicy.isTrusted(webView.url) { UIApplication.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let allowed = origin.protocol == "https" && origin.host == "hewers-system.vercel.app" && [0, 443].contains(origin.port)
            && frame.isMainFrame && AppPolicy.isTrusted(frame.request.url) && AppPolicy.isTrusted(webView.url) && type == .camera
        decisionHandler(allowed ? .prompt : .deny)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { errorPanel.isHidden = true }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    private func failed(_ error: Error) { if (error as NSError).code != NSURLErrorCancelled { errorPanel.isHidden = false; progress.isHidden = true } }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { errorPanel.isHidden = false }

    fileprivate func receiveExport(_ message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == "hewers-system.vercel.app", [0, 443].contains(origin.port), AppPolicy.isTrusted(webView.url) else { return }
        guard !exporting else { alert("Finish saving the current file first."); return }
        guard let value = AppPolicy.parseExport(message.body) else { alert("This export could not be prepared. CSV and text files up to 2 MB are supported."); return }
        do {
            let directory = try exportDirectory()
            let url = directory.appendingPathComponent(value.name)
            try value.data.write(to: url, options: [.atomic, .completeFileProtection])
            share(url)
        } catch { alert("The file could not be prepared. Try again.") }
    }
    private func exportDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("Hewers-" + UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
        var resource = URLResourceValues(); resource.isExcludedFromBackup = true
        var writable = directory; try writable.setResourceValues(resource)
        return directory
    }
    private func share(_ url: URL) {
        guard presentedViewController == nil else { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()); return }
        exporting = true
        let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        activity.popoverPresentationController?.sourceView = view
        activity.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 60, width: 1, height: 1)
        activity.completionWithItemsHandler = { [weak self] _, _, _, _ in
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent()); self?.exporting = false
        }
        present(activity, animated: true)
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        guard !exporting, AppPolicy.isTrusted(webView.url), let url = download.originalRequest?.url,
              AppPolicy.isTrusted(url) || AppPolicy.isTrustedBlob(url), let name = AppPolicy.exportFilename(suggestedFilename) else { completionHandler(nil); return }
        do { let url = try exportDirectory().appendingPathComponent(name); downloads[ObjectIdentifier(download)] = url; completionHandler(url) }
        catch { completionHandler(nil); alert("The download could not be prepared.") }
    }
    func downloadDidFinish(_ download: WKDownload) { if let url = downloads.removeValue(forKey: ObjectIdentifier(download)) { share(url) } }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let url = downloads.removeValue(forKey: ObjectIdentifier(download)) { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        alert("The download failed. Try again.")
    }
}
