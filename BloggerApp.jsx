import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

// Tailwind CSS is assumed to be available.
// This is a self-contained component for a single-file deployment.

const App = () => {
  // Global variables provided by the Canvas environment
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const firebaseConfig = JSON.parse(
    typeof __firebase_config !== 'undefined'
      ? __firebase_config
      : '{}'
  );
  const initialAuthToken =
    typeof __initial_auth_token !== 'undefined'
      ? __initial_auth_token
      : null;

  // State variables for the application
  const [blogs, setBlogs] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);

  // Initialize Firebase and set up authentication
  useEffect(() => {
    if (Object.keys(firebaseConfig).length === 0) {
      console.error('Firebase config is not provided.');
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authentication = getAuth(app);
      setDb(firestore);
      setAuth(authentication);

      const unsubscribeAuth = onAuthStateChanged(authentication, async (user) => {
        if (user) {
          setUserId(user.uid);
          setLoading(false);
          console.log('Signed in as:', user.uid);
        } else {
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(authentication, initialAuthToken);
            } else {
              await signInAnonymously(authentication);
            }
          } catch (error) {
            console.error('Authentication error:', error);
            setLoading(false);
          }
        }
      });

      return () => unsubscribeAuth();
    } catch (error) {
      console.error('Firebase initialization error:', error);
      setLoading(false);
    }
  }, []);

  // Listen for real-time changes to the blog posts
  useEffect(() => {
    if (!db || !userId) return;

    try {
      const blogsCollectionRef = collection(
        db,
        'artifacts',
        appId,
        'users',
        userId,
        'blog_posts'
      );

      const unsubscribe = onSnapshot(blogsCollectionRef, (snapshot) => {
        const blogsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Sort blogs by timestamp in descending order
        blogsData.sort((a, b) => b.timestamp - a.timestamp);
        setBlogs(blogsData);
        setLoading(false);
      }, (error) => {
        console.error("Failed to fetch blogs:", error);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Firestore snapshot error:', error);
      setLoading(false);
    }
  }, [db, userId, appId]);

  // Handle form submission for creating or updating a blog post
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description || !author || !db || !userId) {
      alert('Please fill out all fields.');
      return;
    }

    const blogData = {
      title,
      description,
      author,
      timestamp: serverTimestamp(),
    };

    try {
      if (editingId) {
        // Update an existing blog post
        await updateDoc(
          doc(db, 'artifacts', appId, 'users', userId, 'blog_posts', editingId),
          blogData
        );
      } else {
        // Add a new blog post
        await addDoc(
          collection(db, 'artifacts', appId, 'users', userId, 'blog_posts'),
          blogData
        );
      }
      resetForm();
    } catch (error) {
      console.error('Error adding/updating document:', error);
    }
  };

  // Set the form fields to edit a selected blog post
  const handleEdit = (blog) => {
    setTitle(blog.title);
    setDescription(blog.description);
    setAuthor(blog.author);
    setEditingId(blog.id);
  };

  // Delete a blog post
  const handleDelete = async (id) => {
    if (!db || !userId) return;
    try {
      await deleteDoc(
        doc(db, 'artifacts', appId, 'users', userId, 'blog_posts', id)
      );
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  // Reset the form to its initial state
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAuthor('');
    setEditingId(null);
  };

  // Format the timestamp for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    // Check if it's a Firestore Timestamp object or a number
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleString();
    }
    // If it's a number (for newly created posts before onSnapshot updates)
    return new Date(timestamp).toLocaleString();
  };

  // UI rendering
  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans antialiased text-gray-900">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-blue-600 mb-2 rounded-lg">
            My Blogosphere
          </h1>
          <p className="text-lg text-gray-600">
            A simple and elegant blog management app.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            User ID: <span className="font-mono text-xs">{userId}</span>
          </p>
        </header>

        {/* Blog Post Form */}
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            {editingId ? 'Edit Blog Post' : 'Create New Post'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter title"
                required
              />
            </div>
            <div className="mb-4">
              <label
                htmlFor="author"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Author
              </label>
              <input
                type="text"
                id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your name"
                required
              />
            </div>
            <div className="mb-4">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write your blog content here..."
                required
              ></textarea>
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
              >
                {editingId ? 'Update Post' : 'Add Post'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 transition duration-300"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Blog Post List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800">Your Posts</h2>
          {loading ? (
            <p className="text-center text-gray-500">Loading posts...</p>
          ) : blogs.length === 0 ? (
            <p className="text-center text-gray-500">No posts yet! Create one above.</p>
          ) : (
            blogs.map((blog) => (
              <div
                key={blog.id}
                className="bg-white p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center"
              >
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">
                    {blog.title}
                  </h3>
                  <p className="text-gray-600 mb-2">{blog.description}</p>
                  <p className="text-sm text-gray-500">
                    By {blog.author} on {formatDate(blog.timestamp)}
                  </p>
                </div>
                <div className="mt-4 md:mt-0 flex flex-col md:flex-row gap-2">
                  <button
                    onClick={() => handleEdit(blog)}
                    className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition duration-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(blog.id)}
                    className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition duration-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
