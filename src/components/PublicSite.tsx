import React, { useEffect, useState } from 'react';
import {
  Moon,
  Sun,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Search,
  GraduationCap,
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import booksPhoto from '../assets/images/books_photo.jpg';
import heroCampusImg from '../assets/images/school_campus_hero_1794743578426.jpg';
import scienceLabImg from '../assets/images/science_lab_program_1794743578075.jpg';
import librarySocialImg from '../assets/images/library_social_science_1794743579466.jpg';

type PublicPage = 'home' | 'about' | 'courses' | 'contact';

interface PublicOverviewData {
  settings: Record<string, string>;
  stats: {
    totalStudents: number;
    totalInstructors: number;
    totalCourses: number;
    streamsCount: number;
  };
  streams: Array<{ id: number; code: string; name: string; description: string }>;
  courses: Array<{
    id: number;
    code: string;
    title: string;
    description: string;
    credit_hours: number;
    category_name: string;
    grade_name: string;
    stream_name: string | null;
    stream_code: string | null;
    instructor_name: string | null;
  }>;
  announcements: Array<{
    id: number;
    title: string;
    body: string;
    created_at: string;
    author_name: string;
    author_role: string;
  }>;
}

interface PublicSiteProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const GOVERNANCE_PILLARS = [
  {
    index: '01.',
    title: 'Automated Stream Grading',
    description:
      'Natural Science and Social Science courses apply configurable weighted components (Quizzes, Assignments, Midterm, Final Exam) with instant GPA and class ranking.',
  },
  {
    index: '02.',
    title: 'Unified Boarding Attendance',
    description:
      'Classroom subject registers and residential dormitory roll-calls feed one real-time attendance record accessible to instructors, registrars, and scholars.',
  },
  {
    index: '03.',
    title: 'Verified Fee Clearance',
    description:
      'Finance staff verify bank deposits and cashier receipts directly in the ledger, automatically unlocking official semester report cards and certificates.',
  },
];

export const PublicSite: React.FC<PublicSiteProps> = ({
  onOpenAuth,
  darkMode,
  onToggleDarkMode,
}) => {
  const [page, setPage] = useState<PublicPage>('home');
  const [data, setData] = useState<PublicOverviewData | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [courseSearch, setCourseSearch] = useState<string>('');
  const [contactForm, setContactForm] = useState({
    fullName: '',
    email: '',
    subject: '',
    message: '',
  });
  const [contactStatus, setContactStatus] = useState<{
    type: 'idle' | 'submitting' | 'success' | 'error';
    message?: string;
  }>({ type: 'idle' });

  useEffect(() => {
    apiRequest<PublicOverviewData>('/api/public/overview')
      .then(setData)
      .catch(() => {
        // fallback handled cleanly in render
      });
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactStatus({ type: 'submitting' });
    try {
      const res = await apiRequest<{ message: string }>('/api/public/contact', {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      setContactStatus({ type: 'success', message: res.message });
      setContactForm({ fullName: '', email: '', subject: '', message: '' });
    } catch (err) {
      setContactStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not send message.',
      });
    }
  };

  const filteredCourses = (data?.courses || []).filter((c) => {
    const matchesStream =
      courseFilter === 'ALL'
        ? true
        : courseFilter === 'GENERAL'
        ? !c.stream_code
        : c.stream_code === courseFilter;
    const q = courseSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.instructor_name || '').toLowerCase().includes(q);
    return matchesStream && matchesSearch;
  });

  const openCoursesWithFilter = (filter: string) => {
    setCourseFilter(filter);
    setPage('courses');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FB] text-[#1F2937] dark:bg-[#0B1120] dark:text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text wordmark */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              setPage('home');
            }}
            className="font-display text-lg font-bold tracking-tight text-[#163B65] dark:text-white whitespace-nowrap shrink-0"
          >
            Lich Gogo Academy
          </a>

          {/* Zone 2: 4 single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            {(
              [
                ['home', 'Home'],
                ['about', 'About Us'],
                ['courses', 'Courses'],
                ['contact', 'Contact'],
              ] as Array<[PublicPage, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPage(id)}
                className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 ${
                  page === id
                    ? 'border-[#2563EB] text-[#163B65] dark:text-white font-semibold'
                    : 'border-transparent hover:text-[#163B65] dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="px-4 py-2 text-sm font-medium text-white bg-[#163B65] hover:bg-[#2563EB] rounded-lg whitespace-nowrap shrink-0 shadow-xs"
            >
              Portal Login
            </button>
          </div>
        </div>

        {/* Mobile sub-nav */}
        <div className="md:hidden border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center justify-around text-xs font-medium">
          {(
            [
              ['home', 'Home'],
              ['about', 'About Us'],
              ['courses', 'Courses'],
              ['contact', 'Contact'],
            ] as Array<[PublicPage, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPage(id)}
              className={`px-2.5 py-1.5 rounded-md whitespace-nowrap ${
                page === id
                  ? 'text-[#2563EB] bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1">
        {page === 'home' && (
          <>
            {/* Hero Section — Balanced 2-Column Split */}
            <section className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 lg:py-20 grid lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#14B8A6]">
                    <span>Hosanna, Ethiopia</span>
                    <span aria-hidden="true">·</span>
                    <span>Residential Secondary Academy</span>
                    <span aria-hidden="true">·</span>
                    <span>Grades 9–12</span>
                  </div>
                  <h1
                    className="font-display font-bold tracking-tight text-[#163B65] dark:text-white leading-[1.1]"
                    style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.45rem)', textWrap: 'balance' }}
                  >
                    Lich Gogo Excellence Boarding School LMS
                  </h1>
                  <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                    A unified digital academic platform replacing manual paper records with
                    centralized course delivery, automated stream-weighted grading, boarding
                    attendance tracking, and verified financial clearance.
                  </p>
                  <div className="flex flex-wrap items-center gap-3.5 pt-2">
                    <button
                      type="button"
                      onClick={() => onOpenAuth('login')}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#2563EB] hover:bg-[#163B65] text-white text-sm font-semibold whitespace-nowrap shadow-xs"
                    >
                      <span>Sign In to Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('register')}
                      className="px-6 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-[#163B65] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      Student Registration
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6 flex items-center">
                  <div className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg shadow-[#163B65]/10 group">
                    <div className="gate-photo-frame w-full bg-white">
                      <img
                        src="/assets/aistudio/5957215443552504988_82dbc4eb.jpg"
                        alt="Lich Gogo Excellence Boarding School main campus entrance gate in Hosanna, Ethiopia"
                        className="gate-photo-crop transition-transform duration-300 group-hover:scale-[1.015]"
                      />
                    </div>
                    <div className="px-5 py-4 bg-gradient-to-r from-[#163B65] via-[#1B487A] to-[#163B65] text-white border-t border-white/10">
                      <p className="text-xs text-teal-300 font-semibold">
                        {data?.settings.motto || 'Discipline, Inquiry, and Academic Distinction'}
                      </p>
                      <p className="text-sm font-medium mt-0.5 text-white">
                        Hosanna Residential Campus · Operated by Hadiya Development Association
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full-width 4-column Institutional Summary Bar */}
              <div className="border-t border-slate-200 dark:border-slate-800 bg-[#F5F7FB] dark:bg-slate-950/70">
                <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x md:divide-slate-200 dark:md:divide-slate-800">
                  <div className="md:pr-6">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Enrolled Scholars
                    </div>
                    <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-1">
                      {data?.stats.totalStudents ?? 4}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Boarding students · Grades 9–12
                    </div>
                  </div>
                  <div className="md:px-6">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Faculty Instructors
                    </div>
                    <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-1">
                      {data?.stats.totalInstructors ?? 2}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Subject specialists &amp; advisors
                    </div>
                  </div>
                  <div className="md:px-6">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Accredited Courses
                    </div>
                    <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-1">
                      {data?.stats.totalCourses ?? 6}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      With digital books &amp; syllabi
                    </div>
                  </div>
                  <div className="md:pl-6">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Academic Streams
                    </div>
                    <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-1">
                      {data?.stats.streamsCount ?? 2}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Natural &amp; Social Science tracks
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Featured Academic Streams */}
            <section className="max-w-7xl mx-auto px-4 lg:px-8 py-14 lg:py-16 space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-[#14B8A6]">
                    Focused Pathways
                  </div>
                  <h2 className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-[#163B65] dark:text-white">
                    Senior Secondary Academic Streams
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                    Students specialize in a single dedicated stream with configurable grading
                    strategies, laboratory resources, and dedicated faculty advising.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCoursesWithFilter('ALL')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:text-[#163B65] dark:hover:text-blue-300 whitespace-nowrap shrink-0 self-start md:self-auto"
                >
                  <span>Browse Full Course Catalog</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <article className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <img
                      src={scienceLabImg}
                      alt="Students conducting experiments in the Natural Science laboratory"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  </div>
                  <div className="p-6 lg:p-7 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Stream 01 · Grades 11–12 · STEM Pathway
                      </div>
                      <h3 className="font-display text-xl font-bold text-[#163B65] dark:text-white">
                        Natural Science Stream
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Intensive instruction in Physics, Chemistry, Biology, and Calculus supported
                        by dedicated laboratory coursework and analytical problem sets.
                      </p>
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 truncate">
                        Physics · Chemistry · Calculus
                      </span>
                      <button
                        type="button"
                        onClick={() => openCoursesWithFilter('NATURAL_SCIENCE')}
                        className="font-semibold text-[#2563EB] hover:underline whitespace-nowrap shrink-0"
                      >
                        View Courses
                      </button>
                    </div>
                  </div>
                </article>

                <article className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col hover:border-slate-300 dark:hover:border-slate-700">
                  <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <img
                      src={librarySocialImg}
                      alt="Students studying in the Social Science library and seminar hall"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  </div>
                  <div className="p-6 lg:p-7 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Stream 02 · Grades 11–12 · Humanities &amp; Economics
                      </div>
                      <h3 className="font-display text-xl font-bold text-[#163B65] dark:text-white">
                        Social Science Stream
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Focused curriculum in Macroeconomics, Ethiopian &amp; World History,
                        Geography, and Civic Inquiry preparing future policy and business leaders.
                      </p>
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 truncate">
                        Macroeconomics · History · Literature
                      </span>
                      <button
                        type="button"
                        onClick={() => openCoursesWithFilter('SOCIAL_SCIENCE')}
                        className="font-semibold text-[#2563EB] hover:underline whitespace-nowrap shrink-0"
                      >
                        View Courses
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            {/* Course Books & Digital Learning Resources Showcase */}
            <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-14">
              <div className="bg-gradient-to-br from-white via-white to-[#F2F7FF] dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 lg:p-8 flex flex-col sm:flex-row items-center gap-6 lg:gap-10">
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#F2F7FF] shrink-0">
                  <img
                    src={booksPhoto}
                    alt="Lich Gogo digital textbooks and academic course books"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-3.5 text-center sm:text-left">
                  <div className="text-xs font-semibold text-[#2563EB]">
                    Centralized Textbooks &amp; Course Materials
                  </div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-[#163B65] dark:text-white">
                    Digital Books &amp; Academic Course Library
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    Every accredited subject includes structured course books, lecture notes, lab
                    manuals, and study guides uploaded directly by Lich Gogo faculty for Grades 9–12.
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>Curriculum-Aligned Textbooks</span>
                    <span aria-hidden="true">·</span>
                    <span>Faculty Lecture Notes</span>
                    <span aria-hidden="true">·</span>
                    <span>Practice Workbooks</span>
                  </div>
                  <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <button
                      type="button"
                      onClick={() => openCoursesWithFilter('ALL')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-xs font-semibold shadow-xs"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Explore Course Books</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('login')}
                      className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-[#163B65] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Access Student Materials
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Three Academic Governance Pillars */}
            <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-14">
              <div className="grid md:grid-cols-3 gap-6 border-t border-slate-200 dark:border-slate-800 pt-10">
                {GOVERNANCE_PILLARS.map((pillar) => (
                  <div key={pillar.index} className="space-y-2">
                    <div className="font-mono-tabular text-xs font-semibold text-[#14B8A6]">
                      {pillar.index}
                    </div>
                    <h3 className="font-display text-base font-bold text-[#163B65] dark:text-white">
                      {pillar.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Latest Institutional Announcements */}
            <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-16">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 lg:p-8">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#163B65] dark:text-white">
                      Latest School Announcements
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Official notices from administration and faculty offices
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    Academic Office · Hosanna
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(data?.announcements || []).map((ann) => (
                    <div key={ann.id} className="py-5 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-[#2563EB]">{ann.author_name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{ann.created_at.slice(0, 10)}</span>
                      </div>
                      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                        {ann.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {ann.body}
                      </p>
                    </div>
                  ))}
                  {(!data || data.announcements.length === 0) && (
                    <p className="py-8 text-center text-sm text-slate-500">
                      No public announcements posted at this time.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {page === 'about' && (
          <section className="max-w-5xl mx-auto px-4 lg:px-8 py-12 space-y-10">
            <div className="grid md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-7 space-y-3">
                <p className="text-xs font-semibold text-[#14B8A6]">About the Institution</p>
                <h1
                  className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-[#163B65] dark:text-white"
                  style={{ textWrap: 'balance' }}
                >
                  Lich Gogo Excellence Boarding School
                </h1>
                <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  Located in Hosanna, Hadiya Zone, Ethiopia, Lich Gogo Excellence Boarding School is a
                  selective residential secondary institution committed to rigorous scholarship,
                  ethical character, and structured campus living.
                </p>
              </div>
              <div className="md:col-span-5">
                <div className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                  <img
                    src={heroCampusImg}
                    alt="Lich Gogo Campus Grounds in Hosanna"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 lg:p-7 rounded-xl border border-slate-200 dark:border-slate-800 border-t-2 border-t-[#163B65] space-y-2">
                <h2 className="font-display text-lg font-bold text-[#163B65] dark:text-white">
                  Our Mission
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  To cultivate disciplined, analytically capable graduates across Natural Science and
                  Social Science streams through structured boarding mentorship and transparent,
                  error-free academic governance.
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 lg:p-7 rounded-xl border border-slate-200 dark:border-slate-800 border-t-2 border-t-[#14B8A6] space-y-2">
                <h2 className="font-display text-lg font-bold text-[#163B65] dark:text-white">
                  Our Vision
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  To serve as Ethiopia’s benchmark residential secondary academy where digital
                  learning systems empower teachers, students, registrars, and finance officers with
                  accurate institutional records.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-[#2563EB]" />
                <h2 className="font-display text-xl font-bold text-[#163B65] dark:text-white">
                  Core Educational Objectives
                </h2>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#14B8A6] mt-0.5 shrink-0" />
                  <span>Eliminate manual grade calculation errors through automated weighted GPA and ranking engines.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#14B8A6] mt-0.5 shrink-0" />
                  <span>Maintain unified classroom and dormitory attendance accountability across all boarding blocks.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#14B8A6] mt-0.5 shrink-0" />
                  <span>Provide verified financial fee clearance integrated directly with official report card release.</span>
                </li>
              </ul>
            </div>
          </section>
        )}

        {page === 'courses' && (
          <section className="max-w-7xl mx-auto px-4 lg:px-8 py-12 space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#F2F7FF] shrink-0">
                  <img
                    src={booksPhoto}
                    alt="Course books and curriculum catalog"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h1 className="font-display text-3xl font-bold tracking-tight text-[#163B65] dark:text-white">
                    Academic Course Directory
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Explore active Natural Science, Social Science, and core foundation courses &amp; books.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder="Filter by course or code..."
                    aria-label="Filter courses"
                    className="w-full sm:w-56 pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg self-start max-w-full">
                  {[
                    ['ALL', 'All Courses'],
                    ['NATURAL_SCIENCE', 'Natural Science'],
                    ['SOCIAL_SCIENCE', 'Social Science'],
                    ['GENERAL', 'Core Foundation'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCourseFilter(val)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                        courseFilter === val
                          ? 'bg-[#163B65] text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
                <p className="text-sm font-semibold text-[#163B65] dark:text-white">
                  No courses match your current filter.
                </p>
                <p className="text-xs text-slate-500">
                  Clear the search query or switch back to All Courses.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCourseFilter('ALL');
                    setCourseSearch('');
                  }}
                  className="mt-2 px-4 py-2 rounded-lg bg-[#163B65] text-white text-xs font-medium"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 p-6 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#F2F7FF] shrink-0">
                          <img
                            src={booksPhoto}
                            alt={`${course.title} course book`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono-tabular font-semibold text-[#2563EB]">
                              {course.code}
                            </span>
                            <span className="truncate font-mono-tabular">
                              {course.grade_name} · {course.credit_hours} Credits
                            </span>
                          </div>
                          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
                            {course.title}
                          </h2>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {course.description}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#14B8A6]" />
                        {course.stream_name || 'All Streams'}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {course.instructor_name || 'Faculty Assigned'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {page === 'contact' && (
          <section className="max-w-5xl mx-auto px-4 lg:px-8 py-12 grid md:grid-cols-12 gap-8">
            <div className="md:col-span-5 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#14B8A6]">Admissions &amp; Support</p>
                <h1 className="font-display text-3xl font-bold tracking-tight text-[#163B65] dark:text-white">
                  Contact Admissions &amp; Registrar
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Reach our academic office in Hosanna for student admissions, stream transfers,
                  official transcripts, or boarding inquiries.
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#2563EB] mt-1 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Campus Address</div>
                    <div className="text-slate-600 dark:text-slate-300 text-xs mt-0.5">
                      {data?.settings.location || 'Hosanna, Hadiya Zone, Central Ethiopia'}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-[#2563EB] mt-1 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Telephone</div>
                    <div className="font-mono-tabular text-slate-600 dark:text-slate-300 text-xs mt-0.5">
                      {data?.settings.contact_phone || '+251 46 555 2140'}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#2563EB] mt-1 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Official Email</div>
                    <div className="text-slate-600 dark:text-slate-300 text-xs mt-0.5">
                      {data?.settings.contact_email || 'admissions@lichgogo.edu.et'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 lg:p-8">
              <h2 className="font-display text-xl font-bold text-[#163B65] dark:text-white mb-5">
                Send an Inquiry
              </h2>
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={contactForm.fullName}
                    onChange={(e) => setContactForm({ ...contactForm, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    placeholder="e.g. Samuel Tadesse"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="contact-subject" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    required
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    placeholder="Admissions / Registrar Inquiry"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    required
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    placeholder="How can our academic office help you?"
                  />
                </div>

                {contactStatus.type === 'success' && (
                  <p className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 text-xs font-medium text-teal-800 dark:text-teal-200">
                    {contactStatus.message}
                  </p>
                )}
                {contactStatus.type === 'error' && (
                  <p className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300">
                    {contactStatus.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={contactStatus.type === 'submitting'}
                  className="px-6 py-2.5 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-sm font-semibold shadow-xs"
                >
                  {contactStatus.type === 'submitting' ? 'Sending...' : 'Submit Inquiry'}
                </button>
              </form>
            </div>
          </section>
        )}
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            © 2026 Lich Gogo Excellence Boarding School · Hosanna, Ethiopia
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Light Appearance' : 'Dark Appearance'}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-slate-900 dark:hover:text-white font-semibold text-[#163B65] dark:text-slate-200"
            >
              Staff &amp; Student Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
