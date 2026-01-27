import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate {

    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // Configure WKWebView
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Allow local storage
        webView.configuration.websiteDataStore = WKWebsiteDataStore.default()

        view.addSubview(webView)

        // Load local HTML file
        if let htmlPath = Bundle.main.path(forResource: "index", ofType: "html", inDirectory: "www") {
            let htmlURL = URL(fileURLWithPath: htmlPath)
            let wwwURL = htmlURL.deletingLastPathComponent()
            webView.loadFileURL(htmlURL, allowingReadAccessTo: wwwURL)
        } else {
            // Fallback: try loading from Documents
            let docsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let htmlURL = docsPath.appendingPathComponent("index.html")
            if FileManager.default.fileExists(atPath: htmlURL.path) {
                webView.loadFileURL(htmlURL, allowingReadAccessTo: docsPath)
            } else {
                // Show error message
                let html = """
                <html>
                <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui;background:#faf8f5;">
                    <div style="text-align:center;padding:20px;">
                        <h1 style="color:#4a6741;">MilesToMemories</h1>
                        <p style="color:#6b6b6b;">Loading travel diary...</p>
                    </div>
                </body>
                </html>
                """
                webView.loadHTMLString(html, baseURL: nil)
            }
        }
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .darkContent
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("Page loaded successfully")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("Navigation failed: \(error.localizedDescription)")
    }
}
