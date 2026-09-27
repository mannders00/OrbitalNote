//go:build ios

package main

import "C"

// WailsIOSMain is called by the native delegate after UIKit has launched.
//
//export WailsIOSMain
func WailsIOSMain() { main() }
