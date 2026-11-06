import Foundation

enum AppPolicy {
    static let home = URL(string: "https://hewers-system.vercel.app/")!
    static let maxExportBytes = 2 * 1024 * 1024

    static func isTrusted(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme?.lowercased() == "https"
            && url.host?.lowercased() == "hewers-system.vercel.app"
            && url.user == nil && url.password == nil
            && (url.port == nil || url.port == 443)
    }

    static func isExternalHTTPS(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https" && url.host != nil
            && url.user == nil && url.password == nil
    }

    static func isTrustedBlob(_ url: URL) -> Bool {
        guard url.scheme == "blob", let inner = URL(string: String(url.absoluteString.dropFirst(5))) else { return false }
        return isTrusted(inner)
    }

    static func exportFilename(_ raw: String) -> String? {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
        let name = String(String.UnicodeScalarView(raw.unicodeScalars.map { allowed.contains($0) ? $0 : UnicodeScalar(95)! }))
        guard !name.isEmpty, name.utf8.count <= 100,
              ["csv", "txt"].contains((name as NSString).pathExtension.lowercased()) else { return nil }
        return name.hasPrefix(".") ? "Hewers-" + name : name
    }

    static func parseExport(_ body: Any) -> (name: String, data: Data)? {
        guard let text = body as? String, text.utf8.count <= maxExportBytes + 4096,
              let json = text.data(using: .utf8),
              let value = try? JSONSerialization.jsonObject(with: json) as? [String: Any],
              let rawName = value["name"] as? String, let name = exportFilename(rawName),
              let content = value["text"] as? String, let data = content.data(using: .utf8),
              data.count <= maxExportBytes else { return nil }
        return (name, data)
    }
}
