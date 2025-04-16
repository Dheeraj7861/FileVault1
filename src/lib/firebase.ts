
// This is a temporary mock implementation 
// To be replaced with actual JWT + Express.js + MongoDB backend

// Define User interface to match our needs
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;  // Make this optional
}

// Mock firebase functions
const auth = {
  signInWithEmailAndPassword: async (email: string, password: string) => {
    // For demo purposes - in real app this would call your Express backend
    if (email === "admin@example.com" && password === "password123") {
      return {
        user: {
          uid: "temp-user-id-123",
          email: email,
          displayName: "Admin User",
          photoURL: null
        }
      };
    } else if (email === "user@example.com" && password === "password123") {
      return {
        user: {
          uid: "temp-user-id-456",
          email: email,
          displayName: "Regular User",
          photoURL: null
        }
      };
    }
    // Simulate login failure
    throw {
      code: "auth/wrong-password",
      message: "Invalid email or password"
    };
  },
  createUserWithEmailAndPassword: async (email: string, password: string) => {
    // For demo purposes - in real app this would call your Express backend
    if (email && password.length >= 6) {
      return {
        user: {
          uid: `temp-user-id-${Math.floor(Math.random() * 1000)}`,
          email: email,
          displayName: "",
          photoURL: null
        }
      };
    }
    throw {
      code: "auth/weak-password",
      message: "Password should be at least 6 characters"
    };
  },
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    // Check if we have a token in localStorage
    const userJSON = localStorage.getItem('auth_user');
    if (userJSON) {
      const user = JSON.parse(userJSON);
      callback(user);
    } else {
      callback(null);
    }
    
    // Return an unsubscribe function
    return () => {};
  },
  signOut: async () => {
    localStorage.removeItem('auth_user');
    return Promise.resolve();
  },
  sendPasswordResetEmail: async (email: string) => {
    console.log("Password reset email would be sent to:", email);
    return Promise.resolve();
  },
  currentUser: null
};

// Create type-compatible mock functions
const mockDoc = (id: string, data: any = {}) => ({
  id,
  set: (inputData: any) => Promise.resolve(inputData),
  get: () => Promise.resolve({
    exists: true,
    data: () => ({ ...data, id })
  }),
  update: (updateData: any) => Promise.resolve(updateData)
});

// Mock database functions
const db = {
  collection: (collectionName: string) => ({
    doc: (id: string) => mockDoc(id),
    where: () => ({
      get: () => Promise.resolve({
        docs: []
      })
    }),
    add: (data: any) => Promise.resolve({ id: `temp-id-${Math.floor(Math.random() * 1000)}` })
  }),
  // Provide direct functions that can be used without using firebase.collection syntax
  doc: (path: string, ...segments: string[]) => mockDoc(segments[segments.length - 1] || path.split("/").pop() || ""),
  updateDoc: (ref: any, data: any) => Promise.resolve(data),
  arrayRemove: (item: any) => [item], // Simplified mock for array operations
  onSnapshot: (docRef: any, callback: Function) => {
    // Call once with empty data
    callback({
      exists: true,
      data: () => ({ notifications: [] })
    });
    // Return unsubscribe function
    return () => {};
  }
};

// Mock storage functions
const storage = {};

// Mock Timestamp
class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toDate() {
    return new Date(this.seconds * 1000);
  }

  static now() {
    return new Timestamp(Math.floor(Date.now() / 1000));
  }

  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000));
  }
}

// Export individual functions that match Firebase's structure
export { auth, db, storage, Timestamp };

// Create compatibility layer for Firestore functions
export const collection = db.collection;
export const doc = db.doc;
export const updateDoc = db.updateDoc;
export const arrayRemove = db.arrayRemove;
export const onSnapshot = db.onSnapshot;

export default { auth, db, storage };
