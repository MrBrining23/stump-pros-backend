/**
 * services/photoService.js — Stump Pros WV
 *
 * Cloudinary upload/delete for estimate photos.
 * Uses same CLOUDINARY_* env vars as your social media tool.
 *
 * Required env vars (already in Railway from social media tool):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer     - File buffer from multer
 * @param {string} estimateId - Used to organize in folder
 * @param {string} filename   - Original filename (for reference)
 * @returns {{ url, public_id, width, height }}
 */
async function uploadPhoto(buffer, estimateId, filename = 'photo') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:          `stump-pros/estimates/${estimateId}`,
        resource_type:   'image',
        // Auto-orient based on EXIF (fixes rotated phone photos)
        transformation:  [{ quality: 'auto', fetch_format: 'auto' }],
        use_filename:    true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url:        result.secure_url,
          public_id:  result.public_id,
          width:      result.width,
          height:     result.height,
        });
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}

/**
 * Delete a photo from Cloudinary.
 * @param {string} publicId - Cloudinary public_id stored in DB
 */
async function deletePhoto(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

/**
 * Generate a thumbnail URL from a Cloudinary URL.
 * Returns a 400px-wide version for display.
 */
function thumbnailUrl(cloudinaryUrl, width = 400) {
  // Insert transformation into the URL
  // e.g. .../upload/v123/... → .../upload/w_400,c_fill/v123/...
  return cloudinaryUrl.replace('/upload/', `/upload/w_${width},c_fill,q_auto/`);
}

module.exports = { uploadPhoto, deletePhoto, thumbnailUrl };
