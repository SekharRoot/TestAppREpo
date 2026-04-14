/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { 
  BookOpen, 
  Plus, 
  LogOut, 
  FileText, 
  Link as LinkIcon, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  ChevronRight,
  GraduationCap,
  Calendar,
  Search,
  ArrowLeft,
  FilePlus,
  ExternalLink,
  StickyNote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { cn } from './lib/utils';
import { Course, Material, UserProfile } from './types';
import { format } from 'date-fns';

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) => {
  const variants = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-800',
    secondary: 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
    ghost: 'hover:bg-zinc-100 text-zinc-600'
  };
  
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn(
      'w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all',
      className
    )}
    {...props}
  />
);

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm', className)} {...props}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Ensure user profile exists in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            createdAt: new Date().toISOString()
          });
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Courses Listener
  useEffect(() => {
    if (!user) {
      setCourses([]);
      return;
    }

    const q = query(
      collection(db, 'courses'), 
      where('teacherId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const coursesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(coursesData);
    }, (error) => {
      console.error("Error fetching courses:", error);
    });

    return unsubscribe;
  }, [user]);

  // Materials Listener
  useEffect(() => {
    if (!selectedCourse) {
      setMaterials([]);
      return;
    }

    const q = query(
      collection(db, `courses/${selectedCourse.id}/materials`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const materialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
      setMaterials(materialsData);
    }, (error) => {
      console.error("Error fetching materials:", error);
    });

    return unsubscribe;
  }, [selectedCourse]);

  const handleAddCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const code = formData.get('code') as string;
    const semester = formData.get('semester') as string;
    const year = parseInt(formData.get('year') as string);

    try {
      await addDoc(collection(db, 'courses'), {
        teacherId: user.uid,
        title,
        code,
        semester,
        year,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsAddingCourse(false);
    } catch (error) {
      console.error("Error adding course:", error);
    }
  };

  const handleAddMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCourse) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const type = formData.get('type') as 'link' | 'file' | 'note';
    const url = formData.get('url') as string;
    const content = formData.get('content') as string;

    try {
      await addDoc(collection(db, `courses/${selectedCourse.id}/materials`), {
        courseId: selectedCourse.id,
        title,
        type,
        url: type === 'link' ? url : '',
        content: type === 'note' ? content : '',
        createdAt: new Date().toISOString()
      });
      setIsAddingMaterial(false);
    } catch (error) {
      console.error("Error adding material:", error);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course and all its materials?')) return;
    try {
      await deleteDoc(doc(db, 'courses', courseId));
      if (selectedCourse?.id === courseId) setSelectedCourse(null);
    } catch (error) {
      console.error("Error deleting course:", error);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!selectedCourse) return;
    try {
      await deleteDoc(doc(db, `courses/${selectedCourse.id}/materials`, materialId));
    } catch (error) {
      console.error("Error deleting material:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <GraduationCap className="w-8 h-8 text-zinc-400" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-zinc-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Welcome to SyllabusPro</h1>
          <p className="text-zinc-500 mb-8">
            The professional way for teachers to manage course materials and syllabi.
          </p>
          <Button onClick={signInWithGoogle} className="w-full py-3">
            Sign in with Google
          </Button>
        </Card>
      </div>
    );
  }

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-bottom border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedCourse(null)}>
            <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-zinc-900">SyllabusPro</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full">
              <img 
                src={user.photoURL || ''} 
                alt={user.displayName || ''} 
                className="w-6 h-6 rounded-full"
                referrerPolicy="no-referrer"
              />
              <span className="text-sm font-medium text-zinc-700">{user.displayName}</span>
            </div>
            <Button variant="ghost" onClick={logout} className="p-2">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {!selectedCourse ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900">Your Courses</h2>
                  <p className="text-zinc-500">Manage your syllabi and classroom materials.</p>
                </div>
                <Button onClick={() => setIsAddingCourse(true)}>
                  <Plus className="w-5 h-5" />
                  New Course
                </Button>
              </div>

              {/* Search & Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <Input 
                    placeholder="Search courses by name or code..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Card className="flex items-center justify-center p-4 bg-zinc-900 text-white border-none">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{courses.length}</div>
                    <div className="text-xs text-zinc-400 uppercase tracking-wider">Active Courses</div>
                  </div>
                </Card>
              </div>

              {/* Course Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => (
                  <motion.div 
                    key={course.id}
                    layoutId={course.id}
                    onClick={() => setSelectedCourse(course)}
                    className="cursor-pointer"
                  >
                    <Card className="h-full hover:border-zinc-400 transition-colors group">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs font-bold rounded uppercase tracking-wider">
                            {course.code || 'NO CODE'}
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCourse(course.id);
                            }}
                            className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 mb-2 group-hover:text-zinc-700 transition-colors">
                          {course.title}
                        </h3>
                        <p className="text-zinc-500 text-sm line-clamp-2 mb-6">
                          {course.description || 'No description provided.'}
                        </p>
                        <div className="flex items-center justify-between text-zinc-400 text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {course.semester} {course.year}
                          </div>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}

                {filteredCourses.length === 0 && !isAddingCourse && (
                  <div className="col-span-full py-20 text-center">
                    <div className="w-16 h-16 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900">No courses found</h3>
                    <p className="text-zinc-500">Create your first course to start tracking your syllabus.</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="course-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => setSelectedCourse(null)} className="p-2">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                    <span>{selectedCourse.code}</span>
                    <span>•</span>
                    <span>{selectedCourse.semester} {selectedCourse.year}</span>
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-900">{selectedCourse.title}</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sidebar Info */}
                <div className="space-y-6">
                  <Card className="p-6">
                    <h4 className="font-bold text-zinc-900 mb-4">Course Info</h4>
                    <p className="text-zinc-600 text-sm leading-relaxed mb-6">
                      {selectedCourse.description || 'No description provided.'}
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Created</span>
                        <span className="text-zinc-700 font-medium">{format(new Date(selectedCourse.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Materials</span>
                        <span className="text-zinc-700 font-medium">{materials.length} items</span>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Materials List */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-zinc-900">Course Materials</h3>
                    <Button onClick={() => setIsAddingMaterial(true)} className="py-2">
                      <FilePlus className="w-4 h-4" />
                      Add Material
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {materials.map((material) => (
                      <Card key={material.id} className="p-4 hover:border-zinc-300 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                            material.type === 'link' ? "bg-blue-50 text-blue-600" : 
                            material.type === 'file' ? "bg-purple-50 text-purple-600" : 
                            "bg-amber-50 text-amber-600"
                          )}>
                            {material.type === 'link' ? <LinkIcon className="w-5 h-5" /> : 
                             material.type === 'file' ? <FileText className="w-5 h-5" /> : 
                             <StickyNote className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h5 className="font-bold text-zinc-900 truncate">{material.title}</h5>
                              <button 
                                onClick={() => handleDeleteMaterial(material.id)}
                                className="text-zinc-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            {material.type === 'link' && material.url && (
                              <a 
                                href={material.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-2"
                              >
                                {material.url}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {material.type === 'note' && material.content && (
                              <p className="text-sm text-zinc-600 mb-2 whitespace-pre-wrap">
                                {material.content}
                              </p>
                            )}
                            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
                              Added {format(new Date(material.createdAt), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}

                    {materials.length === 0 && !isAddingMaterial && (
                      <div className="py-12 text-center border-2 border-dashed border-zinc-200 rounded-xl">
                        <p className="text-zinc-500">No materials added yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAddingCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingCourse(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg"
            >
              <Card className="p-8">
                <h3 className="text-2xl font-bold mb-6">Create New Course</h3>
                <form onSubmit={handleAddCourse} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Course Title</label>
                    <Input name="title" placeholder="e.g. Introduction to Computer Science" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">Course Code</label>
                      <Input name="code" placeholder="e.g. CS101" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">Year</label>
                      <Input name="year" type="number" defaultValue={new Date().getFullYear()} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Semester</label>
                    <select 
                      name="semester" 
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all bg-white"
                    >
                      <option>Fall</option>
                      <option>Spring</option>
                      <option>Summer</option>
                      <option>Winter</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsAddingCourse(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      Create Course
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}

        {isAddingMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingMaterial(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg"
            >
              <Card className="p-8">
                <h3 className="text-2xl font-bold mb-6">Add Material</h3>
                <form onSubmit={handleAddMaterial} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Title</label>
                    <Input name="title" placeholder="e.g. Lecture 1 Slides" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Type</label>
                    <select 
                      name="type" 
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all bg-white"
                      onChange={(e) => {
                        const val = e.target.value;
                        const urlInput = document.getElementById('url-input-container');
                        const contentInput = document.getElementById('content-input-container');
                        if (val === 'link') {
                          urlInput?.classList.remove('hidden');
                          contentInput?.classList.add('hidden');
                        } else if (val === 'note') {
                          urlInput?.classList.add('hidden');
                          contentInput?.classList.remove('hidden');
                        } else {
                          urlInput?.classList.add('hidden');
                          contentInput?.classList.add('hidden');
                        }
                      }}
                    >
                      <option value="link">External Link</option>
                      <option value="note">Text Note</option>
                      <option value="file">File Placeholder</option>
                    </select>
                  </div>
                  <div id="url-input-container" className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">URL</label>
                    <Input name="url" placeholder="https://..." />
                  </div>
                  <div id="content-input-container" className="space-y-2 hidden">
                    <label className="text-sm font-medium text-zinc-700">Content</label>
                    <textarea 
                      name="content" 
                      rows={4}
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all bg-white"
                      placeholder="Add your notes here..."
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsAddingMaterial(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      Add Material
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
