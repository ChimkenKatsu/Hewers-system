import XCTest

final class LaunchTests: XCTestCase {
    func testNativeShellDisplaysIsolatedWebContent() {
        let app = XCUIApplication()
        app.launchArguments = ["-hewers-ui-test"]
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
        XCTAssertTrue(app.staticTexts["Hewers iPhone preview"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["Open Hewers in Safari"].exists)
        XCTAssertTrue(app.buttons["Reload Hewers"].exists)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Hewers-iPhone-shell-fixture"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}
