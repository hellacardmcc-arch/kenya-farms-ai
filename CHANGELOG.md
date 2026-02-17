# Changelog

All notable changes to Kenya Farms AI are documented here.

## [2.1.0] - 2025-02-16

### Added

- **Land allocation enforcement**: Crop area cannot exceed available farm land
  - Auto-calculates available land per farm (farm size minus allocated crops)
  - Area input capped to available land when adding crops
  - Shows "Available on this farm" hint in crop registration form
- **No-land feedback**: When all land is allocated
  - Banner: "No more land available. Re-allocate crops or register more farms."
  - Per-farm message when selected farm has no available land
  - Add Crop button disabled when no land available
- **Backend validation**: Farmer service rejects crop creation if area exceeds available farm land
- **`npm run dev`**: Single command to run services + farmer app

### Changed

- **AreaInput**: Manual typing support, `max` and `hint` props for land allocation
- **MyCropsView**: Farm selection auto-clamps area; pre-selects first farm with available land when opening add form

### Fixed

- AreaInput syntax error (missing closing brace)
- Area size input now accepts manual typing (e.g. 1.5, 2.25)

---

## [2.0.0] - Previous release

- Complete modular system with 7 microservices
- 3 frontends (farmer, admin, public)
- Farm and crop management
- IoT device integration
