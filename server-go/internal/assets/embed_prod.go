//go:build embed

package assets

import "embed"

//go:embed all:../../../dist/public
var Public embed.FS

const IsEmbedded = true
