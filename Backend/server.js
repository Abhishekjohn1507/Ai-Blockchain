const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
// const { ethers } = require('ethers');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// IPFS configuration
const IPFS_API = {
    host: process.env.IPFS_HOST || 'localhost',
    port: process.env.IPFS_PORT || 5001,
    protocol: process.env.IPFS_PROTOCOL || 'http'
};

const getIpfsUrl = () => `${IPFS_API.protocol}://${IPFS_API.host}:${IPFS_API.port}/api/v0`;

// Smart contract configuration - temporarily commented out
// const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
// const CONTRACT_ABI = require('../contracts/VisualCryptoStorage.json').abi;

// Initialize Ethereum provider - temporarily commented out
// const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_PROVIDER_URL);
// const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        status: err.status || 500
    });
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

// API Routes
app.post('/api/encrypt', upload.single('image'), async (req, res) => {
    try {
        const { file } = req;
        if (!file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Call Python script for visual cryptography
        const pythonProcess = spawn('python', [
            '../ai/visual_crypto.py',
            '--mode', 'encrypt',
            '--input', file.path
        ]);

        let shares = [];
        pythonProcess.stdout.on('data', (data) => {
            shares = JSON.parse(data.toString());
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'Encryption failed' });
            }

            // Upload shares to IPFS
            const ipfsHashes = await Promise.all(
                shares.map(async (share) => {
                    const formData = new FormData();
                    formData.append('file', Buffer.from(share));
                    const response = await axios.post(`${getIpfsUrl()}/add`, formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    });
                    return response.data.Hash;
                })
            );

            // Store IPFS hashes in smart contract - temporarily commented out
            // const signer = provider.getSigner();
            // const contractWithSigner = contract.connect(signer);
            // const tx = await contractWithSigner.storeShare(ipfsHashes[0]);
            // await tx.wait();

            res.json({
                success: true,
                shares: ipfsHashes
            });
        });
    } catch (error) {
        console.error('Encryption error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/decrypt', async (req, res) => {
    try {
        const { shares } = req.body;
        if (!shares || !Array.isArray(shares)) {
            return res.status(400).json({ error: 'Invalid shares provided' });
        }

        // Download shares from IPFS
        const shareBuffers = await Promise.all(
            shares.map(async hash => {
                const response = await axios.get(`${getIpfsUrl()}/cat?arg=${hash}`, {
                    responseType: 'arraybuffer'
                });
                return Buffer.from(response.data);
            })
        );

        // Call Python script for decryption
        const pythonProcess = spawn('python', [
            '../ai/visual_crypto.py',
            '--mode', 'decrypt'
        ]);

        pythonProcess.stdin.write(JSON.stringify(shareBuffers));
        pythonProcess.stdin.end();

        let reconstructedImage;
        pythonProcess.stdout.on('data', (data) => {
            reconstructedImage = data;
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'Decryption failed' });
            }

            res.json({
                success: true,
                image: reconstructedImage.toString('base64')
            });
        });
    } catch (error) {
        console.error('Decryption error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/shares/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const shareCount = await contract.getShareCount(address);
        const shares = [];

        for (let i = 0; i < shareCount; i++) {
            const share = await contract.getShare(address, i);
            if (share.isValid) {
                shares.push({
                    id: i,
                    ipfsHash: share.ipfsHash,
                    timestamp: share.timestamp.toString()
                });
            }
        }

        res.json({ shares });
    } catch (error) {
        console.error('Error fetching shares:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/store', async (req, res, next) => {
    try {
        const { data } = req.body;
        if (!data) {
            throw new Error('No data provided');
        }

        console.log('Attempting to store data in IPFS...');
        const formData = new FormData();
        formData.append('file', Buffer.from(data));
        
        console.log('Making request to IPFS API:', `${getIpfsUrl()}/add`);
        const response = await axios.post(`${getIpfsUrl()}/add`, formData, {
            headers: {
                ...formData.getHeaders()
            }
        });
        
        console.log('IPFS response:', response.data);
        res.json({ ipfsHash: response.data.Hash });
    } catch (error) {
        console.error('Storage error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        next(error);
    }
});

app.get('/api/retrieve/:hash', async (req, res, next) => {
    try {
        const { hash } = req.params;
        if (!hash) {
            throw new Error('No hash provided');
        }

        console.log('Attempting to retrieve from IPFS:', hash);
        const response = await axios.get(`${getIpfsUrl()}/cat?arg=${hash}`, {
            responseType: 'arraybuffer'
        });
        
        console.log('Successfully retrieved data from IPFS');
        const data = Buffer.from(response.data).toString();
        res.json({ data });
    } catch (error) {
        console.error('Retrieval error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        next(error);
    }
});

// Health check endpoint with IPFS status
app.get('/api/health', async (req, res) => {
    try {
        // Test IPFS connection
        await axios.get(`${getIpfsUrl()}/version`);
        res.json({ 
            status: 'healthy',
            ipfs: 'connected'
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'unhealthy',
            ipfs: 'disconnected',
            error: error.message
        });
    }
});

// Apply error handling middleware
app.use(errorHandler);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`IPFS API URL: ${getIpfsUrl()}`);
}); 