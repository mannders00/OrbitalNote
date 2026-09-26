// Generate the application's original icon with only the Go standard library.
package main

import (
	"image"
	"image/color"
	"image/png"
	"log"
	"math"
	"os"
)

func main() {
	if len(os.Args) != 2 {
		log.Fatal("usage: appicon OUTPUT.png")
	}
	const size = 1024
	img := image.NewNRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			// Rounded-square signed distance, with a transparent native-icon margin.
			dx, dy := math.Abs(float64(x)-511.5)-280, math.Abs(float64(y)-511.5)-280
			distance := math.Hypot(math.Max(dx, 0), math.Max(dy, 0)) + math.Min(math.Max(dx, dy), 0) - 160
			alpha := uint8(math.Max(0, math.Min(1, .5-distance)) * 255)
			c := color.NRGBA{R: 50, G: 116, B: 205, A: alpha}
			// A quiet white 'o' and pale blue dot, matching the sidebar mark.
			ring := math.Abs(math.Hypot(float64(x)-448, float64(y)-512)-161) - 39
			blend := math.Max(0, math.Min(1, .5-ring))
			c.R = uint8(float64(c.R)*(1-blend) + 255*blend)
			c.G = uint8(float64(c.G)*(1-blend) + 255*blend)
			c.B = uint8(float64(c.B)*(1-blend) + 255*blend)
			dot := math.Hypot(float64(x)-740, float64(y)-470) - 44
			blend = math.Max(0, math.Min(1, .5-dot))
			c.R = uint8(float64(c.R)*(1-blend) + 185*blend)
			c.G = uint8(float64(c.G)*(1-blend) + 214*blend)
			c.B = uint8(float64(c.B)*(1-blend) + 250*blend)
			img.SetNRGBA(x, y, c)
		}
	}
	f, err := os.Create(os.Args[1])
	if err != nil {
		log.Fatal(err)
	}
	if err = png.Encode(f, img); err != nil {
		f.Close()
		log.Fatal(err)
	}
	if err = f.Close(); err != nil {
		log.Fatal(err)
	}
}
