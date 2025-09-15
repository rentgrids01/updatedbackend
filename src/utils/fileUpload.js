const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create subdirectories
const subdirs = [
    'property_images', 
    'property_documents', 
    'profile_photos', 
    'tenant_documents', 
    'owner_documents',
    'chat_images', 
    'video_intros', 
    'feature_icons', 
    'amenity_icons',
    'avatars'
];

subdirs.forEach(dir => {
    const dirPath = path.join(uploadsDir, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

const saveFile = async (fileBuffer, folder, originalName) => {
    try {
        const fileExtension = path.extname(originalName);
        const fileName = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(uploadsDir, folder, fileName);

        // Save file to local storage
        fs.writeFileSync(filePath, fileBuffer);

        // Return URL that can be served by Express
        const fileUrl = `/uploads/${folder}/${fileName}`;

        return {
            success: true,
            url: fileUrl,
            filename: fileName,
            originalName: originalName,
            path: filePath
        };
    } catch (error) {
        throw new Error(`Failed to save file: ${error.message}`);
    }
};

const deleteFile = async (fileUrl) => {
    try {
        if (fileUrl && fileUrl.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '../../', fileUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return { success: true };
            }
        }
        return { success: false, message: 'File not found' };
    } catch (error) {
        throw new Error(`Failed to delete file: ${error.message}`);
    }
};

module.exports = {
    saveFile,
    deleteFile
};