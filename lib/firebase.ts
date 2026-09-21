export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBg3xce3VkN7TurRNd8hpeH-mXpNhjG-gE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "escritorionota10.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "escritorionota10",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "escritorionota10.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "716631586823",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:716631586823:web:790521f87981853b9fd2a2",
} as const;

export function assertFirebaseConfig() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) throw new Error(`Configuração Firebase incompleta: ${missing.join(", ")}`);
  return firebaseConfig;
}
