const express = require('express');
const cors = require('cors');
const { create } = require('ipfs-http-client');
const { ethers } = require('ethers');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// Initialize IPFS client
const ipfs = create('http://localhost:5001');

// Smart contract configuration
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const CONTRACT_ABI = require('./contracts/VisualCryptoStorage.json').abi;

// Initialize Ethereum provider
const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_PROVIDER_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

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
                    const result = await ipfs.add(Buffer.from(share));
                    return result.path;
                })
            );

            // Store IPFS hashes in smart contract
            const signer = provider.getSigner();
            const contractWithSigner = contract.connect(signer);
            const tx = await contractWithSigner.storeShare(ipfsHashes[0]);
            await tx.wait();

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
            shares.map(hash => ipfs.cat(hash))
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

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 