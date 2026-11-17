# Admin catalog GLB compression

## What changes
- Add a Catalog upload mode to the existing admin 3D Models workspace, alongside product-variant and bulk uploads.
- Let admins create the required catalog item details or select an existing catalog item, then choose one raw `.glb` file.
- Compress in the browser before upload: Draco mesh compression, textures capped at 1024×1024, and WebP texture output.
- Upload only the optimized GLB to the existing assets bucket and save its public URL in the catalog item's `glb_url_compressed` field.
- Show compression, upload, success, and failure states without replacing the selected file or catalog details on failure.

## Technical details
- Add a focused browser utility using `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, and `draco3dgltf`; load the Draco encoder/decoder only when this upload path is used.
- Keep the existing trade-product variant upload behavior unchanged.
- Reuse the existing public assets storage and admin-only `catalog_items` write policies; no schema change is needed.
- Add regression tests for raw-GLB compression, texture limits, upload content/path, and create/update persistence.
- Verify the admin flow in the browser with a real GLB and confirm the stored URL and compressed model.

## Verification limits
- Report any device/theme or live-storage checks that cannot be completed rather than treating compilation as proof of upload success.
