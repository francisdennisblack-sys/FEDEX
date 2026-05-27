// Firebase Initialization and Database Functions
// This module handles all Firebase operations for the WiFi Grid

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, onValue } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import firebaseConfig from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

/**
 * Create or update a post in Firebase (shared collection)
 * @param {string} postId - Unique post ID
 * @param {object} postData - Post data (content, timestamp, authId, etc)
 */
export async function savePost(postId, postData) {
    try {
        const postRef = ref(database, `posts/${postId}`);
        await set(postRef, postData);
        console.log(`Post saved to shared collection: ${postId}`);
        return { success: true, postId };
    } catch (error) {
        console.error('Error saving post:', error);
        throw error;
    }
}

/**
 * Get all posts from shared collection
 * @returns {Promise<array>} Array of posts
 */
export async function getPosts() {
    try {
        const postsRef = ref(database, `posts`);
        const snapshot = await get(postsRef);
        
        if (snapshot.exists()) {
            const postsObj = snapshot.val();
            // Convert object to array
            return Object.keys(postsObj).map(key => ({
                id: key,
                ...postsObj[key]
            }));
        }
        return [];
    } catch (error) {
        console.error('Error getting posts:', error);
        return [];
    }
}

/**
 * Subscribe to real-time updates for shared posts collection
 * @param {function} callback - Function to call when posts change
 * @returns {function} Unsubscribe function
 */
export function subscribeToPostsRealTime(callback) {
    try {
        const postsRef = ref(database, `posts`);
        
        const unsubscribe = onValue(postsRef, (snapshot) => {
            if (snapshot.exists()) {
                const postsObj = snapshot.val();
                const posts = Object.keys(postsObj).map(key => ({
                    id: key,
                    ...postsObj[key]
                }));
                callback(posts);
            } else {
                callback([]);
            }
        }, (error) => {
            console.error('Error subscribing to posts:', error);
        });
        
        return unsubscribe;
    } catch (error) {
        console.error('Error in subscribeToPostsRealTime:', error);
        return () => {}; // Return empty unsubscribe function
    }
}

/**
 * Upload a photo to Firebase Storage
 * @param {string} postId - Post ID
 * @param {File} file - Image file to upload
 * @returns {Promise<string>} Download URL of uploaded file
 */
export async function uploadPhoto(postId, file) {
    try {
        // Create a path: posts/{postId}/photo
        const photoPath = `posts/${postId}/photo`;
        const photoRef = storageRef(storage, photoPath);
        
        // Upload the file
        const snapshot = await uploadBytes(photoRef, file);
        console.log(`Photo uploaded: ${photoPath}`);
        
        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading photo:', error);
        throw error;
    }
}

/**
 * Delete a post from shared collection
 * @param {string} postId - Post ID to delete
 */
export async function deletePost(postId) {
    try {
        const postRef = ref(database, `posts/${postId}`);
        await remove(postRef);
        console.log(`Post deleted: ${postId}`);
        return { success: true };
    } catch (error) {
        console.error('Error deleting post:', error);
        throw error;
    }
}

/**
 * Delete a photo from Firebase Storage
 * @param {string} postId - Post ID
 */
export async function deletePhoto(postId) {
    try {
        const photoPath = `posts/${postId}/photo`;
        const photoRef = storageRef(storage, photoPath);
        await deleteObject(photoRef);
        console.log(`Photo deleted: ${photoPath}`);
    } catch (error) {
        console.error('Error deleting photo:', error);
        // Don't throw - photo might not exist
    }
}

/**
 * Update post votes (likes/dislikes) in shared collection
 * @param {string} postId - Post ID
 * @param {object} updates - Fields to update (likes, dislikes)
 */
export async function updatePostVotes(postId, updates) {
    try {
        const postRef = ref(database, `posts/${postId}`);
        await update(postRef, updates);
        console.log(`Post votes updated: ${postId}`);
        return { success: true };
    } catch (error) {
        console.error('Error updating votes:', error);
        throw error;
    }
}

export { database, storage, app };
