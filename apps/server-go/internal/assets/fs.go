package assets

import "io/fs"

// Public holds the SPA static tree (embedded in release builds, disk in dev).
var Public fs.FS
