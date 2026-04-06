import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import AWS from 'aws-sdk';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Schema
const fileSchema = new mongoose.Schema({
    fileId: { type: String, required: true, unique: true },
    name: String,
    size: Number,
    type: String,
    storageKey: String,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
});

const File = mongoose.model('File', fileSchema);

// S3 Configuration (Cloudflare R2 / AWS S3)
const s3 = new AWS.S3({
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    signatureVersion: 'v4',
    s3ForcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// 1. Initialize Multipart Upload
app.post('/api/upload/init', async (req, res) => {
    const { name, type, size } = req.body;
    const fileId = nanoid();
    const storageKey = `uploads/${fileId}-${name}`;

    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: storageKey,
            ContentType: type,
        };

        const multiPartUpload = await s3.createMultipartUpload(params).promise();

        const fileEntry = new File({
            fileId,
            name,
            size,
            type,
            storageKey,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        });
        await fileEntry.save();

        res.json({
            uploadId: multiPartUpload.UploadId,
            key: storageKey,
            fileId,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Generate Pre-signed URL for a part
app.post('/api/upload/sign-part', async (req, res) => {
    const { uploadId, key, partNumber } = req.body;

    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: key,
            PartNumber: partNumber,
            UploadId: uploadId,
            Expires: 3600,
        };

        const url = await s3.getSignedUrlPromise('uploadPart', params);
        res.json({ url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Complete Multipart Upload
app.post('/api/upload/complete', async (req, res) => {
    const { uploadId, key, parts, fileId } = req.body;

    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
            },
        };

        await s3.completeMultipartUpload(params).promise();
        await File.findOneAndUpdate({ fileId }, { status: 'completed' });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Get File Metadata
app.get('/api/file/:fileId', async (req, res) => {
    try {
        const file = await File.findOne({ fileId: req.params.fileId });
        if (!file) return res.status(404).json({ error: 'File not found' });

        // Generate download URL
        const url = s3.getSignedUrl('getObject', {
            Bucket: BUCKET_NAME,
            Key: file.storageKey,
            Expires: 3600,
        });

        res.json({ ...file.toObject(), downloadUrl: url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/flashshare';

mongoose.connect(MONGO_URI)
    .then(() => {
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => console.error('MongoDB connection error:', err));
