import React, { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

interface Share {
    id: number;
    ipfsHash: string;
    timestamp: string;
}

const VisualCrypto: React.FC = () => {
    const [shares, setShares] = useState<Share[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reconstructedImage, setReconstructedImage] = useState<string | null>(null);

    // Connect to Ethereum wallet
    const connectWallet = async () => {
        try {
            if (!window.ethereum) {
                throw new Error('Please install MetaMask');
            }

            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const address = await signer.getAddress();

            // Fetch user's shares
            const response = await axios.get(`/api/shares/${address}`);
            setShares(response.data.shares);
        } catch (err) {
            setError(err.message);
        }
    };

    // Handle file drop for encryption
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        try {
            setLoading(true);
            setError(null);

            const file = acceptedFiles[0];
            const formData = new FormData();
            formData.append('image', file);

            const response = await axios.post('/api/encrypt', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setShares(prevShares => [...prevShares, ...response.data.shares]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg']
        }
    });

    // Reconstruct image from shares
    const reconstructImage = async (selectedShares: Share[]) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.post('/api/decrypt', {
                shares: selectedShares.map(share => share.ipfsHash)
            });

            setReconstructedImage(`data:image/png;base64,${response.data.image}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">
                Visual Cryptography System
            </h1>

            {/* Wallet Connection */}
            <button
                onClick={connectWallet}
                className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
            >
                Connect Wallet
            </button>

            {/* File Upload */}
            <div
                {...getRootProps()}
                className={`border-2 border-dashed p-8 mb-4 text-center cursor-pointer
                    ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            >
                <input {...getInputProps()} />
                {isDragActive ? (
                    <p>Drop the image here...</p>
                ) : (
                    <p>Drag & drop an image here, or click to select</p>
                )}
            </div>

            {/* Shares List */}
            <div className="mb-4">
                <h2 className="text-xl font-semibold mb-2">Your Shares</h2>
                <div className="grid grid-cols-3 gap-4">
                    {shares.map((share) => (
                        <div
                            key={share.id}
                            className="border p-4 rounded"
                        >
                            <p className="font-mono text-sm break-all">
                                {share.ipfsHash}
                            </p>
                            <p className="text-sm text-gray-500">
                                {new Date(parseInt(share.timestamp) * 1000).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reconstructed Image */}
            {reconstructedImage && (
                <div className="mb-4">
                    <h2 className="text-xl font-semibold mb-2">
                        Reconstructed Image
                    </h2>
                    <img
                        src={reconstructedImage}
                        alt="Reconstructed"
                        className="max-w-md border rounded"
                    />
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded">
                        Processing...
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}
        </div>
    );
};

export default VisualCrypto; 