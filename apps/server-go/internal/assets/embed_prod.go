//go:build embed

package assets

import (
	"embed"
	"io/fs"
)

//go:embed all:public
var publicEmbed embed.FS

const IsEmbedded = true

func init() {
	sub, err := fs.Sub(publicEmbed, "public")
	if err != nil {
		panic("assets: embed public: " + err.Error())
	}
	Public = sub
}
