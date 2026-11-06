import XCTest
@testable import Hewers

final class AppPolicyTests: XCTestCase {
    func testTrustedOriginAndSpoofedURLs() {
        for value in ["https://hewers-system.vercel.app/", "https://hewers-system.vercel.app:443/login?next=home"] { XCTAssertTrue(AppPolicy.isTrusted(URL(string: value))) }
        for value in ["http://hewers-system.vercel.app", "https://hewers-system.vercel.app.evil.example", "https://hewers-system.vercel.app@evil.example", "https://user:secret@hewers-system.vercel.app", "https://hewers-system.vercel.app:8443", "file:///tmp/report.csv", "javascript:alert(1)"] { XCTAssertFalse(AppPolicy.isTrusted(URL(string: value)), value) }
        XCTAssertFalse(AppPolicy.isTrusted(nil))
        XCTAssertTrue(AppPolicy.isTrustedBlob(URL(string: "blob:https://hewers-system.vercel.app/uuid")!))
        XCTAssertFalse(AppPolicy.isTrustedBlob(URL(string: "blob:https://evil.example/uuid")!))
    }
    func testExportParsingAndSizeLimits() throws {
        let payload = try JSONSerialization.data(withJSONObject: ["name":"attendance.csv", "text":"worker,time\nSample,08:00"])
        let value = AppPolicy.parseExport(String(decoding: payload, as: UTF8.self))
        XCTAssertEqual(value?.name, "attendance.csv")
        XCTAssertEqual(value?.data, Data("worker,time\nSample,08:00".utf8))
        XCTAssertNil(AppPolicy.parseExport("{bad json"))
        XCTAssertNil(AppPolicy.parseExport(["name":"report.csv"]))
        XCTAssertNil(AppPolicy.exportFilename("report.html"))
        XCTAssertNil(AppPolicy.exportFilename(String(repeating: "a", count: 101) + ".csv"))
        XCTAssertFalse(AppPolicy.exportFilename("../../attendance.csv")!.contains("/"))
        let large = try JSONSerialization.data(withJSONObject: ["name":"report.csv", "text":String(repeating: "é", count: AppPolicy.maxExportBytes)])
        XCTAssertNil(AppPolicy.parseExport(String(decoding: large, as: UTF8.self)))
    }
}
