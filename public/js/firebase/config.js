// Firebase configuration - SIMPLE CDN VERSION
const firebaseConfig = {
    apiKey: "AIzaSyC6X36Z5_aivg8FbVZofieA5a92wmUESnA",
    authDomain: "golden-yolk-market.firebaseapp.com",
    projectId: "golden-yolk-market",
    storageBucket: "golden-yolk-market.firebasestorage.app",
    messagingSenderId: "1051912019274",
    appId: "1:1051912019274:web:9a61028da441d43c1435b3",
    measurementId: "G-06RHJF9P27"
};

// Initialize Firebase immediately when this file loads
console.log('Initializing Firebase...');

if (typeof firebase !== 'undefined') {
    try {
        // Initialize Firebase if not already initialized
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase initialized successfully!');
        } else {
            console.log('ℹFirebase already initialized');
        }

        // Make services available globally - ONLY initialize available services
        window.firebaseAuth = firebase.auth();
        window.firebaseDb = firebase.firestore();
        
        // Only initialize storage if the SDK is available
        if (typeof firebase.storage === 'function') {
            window.firebaseStorage = firebase.storage();
            console.log('Storage service available');
        } else {
            console.log('Storage service not available - skipping');
            window.firebaseStorage = null;
        }
        
        console.log('Firebase services ready!');
        console.log('- Auth:', !!window.firebaseAuth);
        console.log('- Firestore:', !!window.firebaseDb);
        console.log('- Storage:', !!window.firebaseStorage);

    } catch (error) {
        console.error('Firebase initialization failed:', error);
    }
} else {
    console.error('Firebase SDK not loaded! Check script order.');
}