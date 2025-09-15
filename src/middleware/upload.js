const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedImages = /\.(jpg|jpeg|png|gif|webp)$/i;
  const allowedDocs = /\.(pdf|doc|docx)$/i;
  const allowedVideos = /\.(mp4|avi|mov|wmv)$/i;

  const extension = path.extname(file.originalname);
  
  if (allowedImages.test(extension) || allowedDocs.test(extension) || allowedVideos.test(extension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, documents, and videos are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

module.exports = upload;