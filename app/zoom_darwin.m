//go:build darwin && !ios && !server

#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

void orgWorkspaceInputDefaults(void) {
    // Application-domain preferences: do not change the user's system defaults.
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    for (NSString *key in @[@"ApplePressAndHoldEnabled", @"NSAutomaticSpellingCorrectionEnabled", @"NSAutomaticTextCompletionEnabled", @"NSAutomaticQuoteSubstitutionEnabled", @"NSAutomaticDashSubstitutionEnabled", @"NSAutomaticPeriodSubstitutionEnabled"]) {
        [defaults setBool:NO forKey:key];
    }
}

static WKWebView *findWebView(NSView *view) {
    if ([view isKindOfClass:[WKWebView class]]) return (WKWebView *)view;
    for (NSView *child in view.subviews) {
        WKWebView *webView = findWebView(child);
        if (webView) return webView;
    }
    return nil;
}

void orgWorkspaceZoom(void *nativeWindow, int direction) {
    NSWindow *window = (NSWindow *)nativeWindow;
    WKWebView *webView = findWebView(window.contentView);
    if (!webView) return;
    // Page zoom changes the layout viewport, including viewport units and
    // responsive breakpoints, rather than magnifying it beyond the window.
    webView.magnification = 1.0;
    double zoom = direction == 0 ? 1.0 : webView.pageZoom + direction * 0.1;
    webView.pageZoom = fmin(3.0, fmax(0.5, zoom));
}
