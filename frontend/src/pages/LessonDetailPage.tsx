import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { type Course, type Student, type AttendanceRecord, type Achievement } from '../services/api';
import { validateStudentForm, hasErrors, type StudentFormErrors } from '../services/validation';

const STATUSES = [
  { key: 'present', label: 'Был', icon: '✅', color: 'green' },
  { key: 'trial', label: 'Пробное', icon: '🌟', color: 'purple' },
  { key: 'late', label: 'Опоздал', icon: '⏰', color: 'amber' },
  { key: 'absent', label: 'Не был', icon: '❌', color: 'red' },
] as const;

const LESSON_STATUSES = [
  { key: 'scheduled', label: 'Проводится', icon: '✅', color: 'green' },
  { key: 'cancelled', label: 'Отменено', icon: '❌', color: 'red' },
  { key: 'rescheduled', label: 'Перенесено', icon: '🔄', color: 'amber' },
] as const;

const ACHIEVEMENT_ICONS = ['🏆', '🌟', '🎯', '🤖', '🎨', '⚡', '🔥', '💡', '🎵', '🏅', '📐', '🧩', '🎪', '🚀', '🌈'];

function getTodayDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Проверка пересечения временных интервалов ───────────────────────────
function timesOverlap(
  start1: string, end1: string,
  start2: string, end2: string
): boolean {
  if (!start1 || !start2) return false;
  if (!end1 || !end2) return start1 === start2;
  return start1 < end2 && end1 > start2;
}

// ─── Вспомогательная функция для отображения времени ──────────────────────
function getTimeDisplay(lesson: { start_time?: string; end_time?: string; time?: string }): string {
  const startTime = lesson.start_time || lesson.time || '';
  const endTime = lesson.end_time || '';
  if (startTime && endTime) {
    return `${startTime} — ${endTime}`;
  }
  return startTime || '—';
}

// ─── Lesson type (from backend) ────────────────────────────────────────────

interface LessonData {
  id: string;
  course_id: string;
  date: string;
  time: string;
  start_time: string;
  end_time: string;
  title: string;
  status: string;
  homework: string;
  location: string;
  location_link: string;
  note: string;
  student_count: number;
  attendance_stats: {
    present: number;
    late: number;
    absent: number;
    trial: number;
    unmarked: number;
    total_marked: number;
  };
  unmarked_students: Array<{ id: string; first_name: string; last_name: string }>;
}

export default function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { permissions } = useAuth();

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [commentsMap, setCommentsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStudent, setSavingStudent] = useState<string | null>(null);

  // ── Lesson management state ─────────────────────────────────────────────
  const [lessonStatus, setLessonStatus] = useState<string>('scheduled');
  const [homework, setHomework] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showHomeworkEdit, setShowHomeworkEdit] = useState(false);
  const [homeworkDraft, setHomeworkDraft] = useState('');

  // ── Group management state ──────────────────────────────────────────
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [removingStudent, setRemovingStudent] = useState<string | null>(null);

  // ── Cancel/Reschedule modal state ────────────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelAction, setCancelAction] = useState<'cancelled' | 'rescheduled' | null>(null);
  const [cancelSaving, setCancelSaving] = useState(false);

  // ── Reschedule modal state ────────────────────────────────────────────
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleConflict, setRescheduleConflict] = useState<string | null>(null);
  const [allLessons, setAllLessons] = useState<any[]>([]);

  // Load all lessons once for conflict detection
  useEffect(() => {
    api.getLessons().then(d => setAllLessons(d.lessons || [])).catch(() => {});
  }, []);

  // ── Conflict detection for reschedule ─────────────────────────────────
  const checkLessonConflict = (date: string, time: string) => {
    if (!date || !time || !lesson) {
      setRescheduleConflict(null);
      return;
    }
    const conflict = allLessons.find(l => {
      if (l.date !== date) return false;
      if (l.status === 'cancelled') return false;
      if (l.id === lesson.id) return false;
      const lStart = l.start_time || l.time || '';
      const lEnd = l.end_time || '';
      return timesOverlap(time, lesson.end_time || '', lStart, lEnd);
    });
    if (conflict) {
      const cStart = conflict.start_time || conflict.time || '';
      const cEnd = conflict.end_time || '';
      const conflictTime = cStart && cEnd ? `${cStart}—${cEnd}` : cStart;
      setRescheduleConflict(`⚠️ «${conflict.title || ''}» уже в этот промежуток (${conflictTime})`);
    } else {
      setRescheduleConflict(null);
    }
  };

  // ── Student achievements state ───────────────────────────────────────
  const [achievementsMap, setAchievementsMap] = useState<Record<string, Achievement[]>>({});
  const [expandedAchievements, setExpandedAchievements] = useState<Record<string, boolean>>({});
  const [showAddAchievement, setShowAddAchievement] = useState<string | null>(null);
  const [newAchievement, setNewAchievement] = useState({ icon: '🏆', title: '', description: '' });
  const [savingAchievement, setSavingAchievement] = useState(false);

  // ── Add student state ──────────────────────────────────────────────────
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addMode, setAddMode] = useState<'new' | 'existing'>('new');
  const [newStudent, setNewStudent] = useState({ first_name: '', last_name: '', phone: '' });
  const [newStudentErrors, setNewStudentErrors] = useState<StudentFormErrors>({});
  const [addingStudent, setAddingStudent] = useState(false);

  // ── Existing student search state ──────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const commentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const today = getTodayDate();

  useEffect(() => {
    if (!lessonId) { setError('Не указан ID занятия'); setLoading(false); return; }
    loadLesson(lessonId);
    return () => {
      Object.values(commentTimers.current).forEach(t => clearTimeout(t));
    };
  }, [lessonId]);

  const loadLesson = async (id: string) => {
    try {
      setLoading(true);
      const lessonData = await api.getLesson(id);

      setLesson(lessonData);
      setLessonStatus(lessonData.status);
      setHomework(lessonData.homework || '');

      // Load course details
      if (lessonData.course_id) {
        try {
          const courseData = await api.getCourse(lessonData.course_id);
          setCourse(courseData);
        } catch (e) {
          console.error('Failed to load course:', e);
        }
      }

      // Load attendance for this lesson's date FIRST
      // (students shown are ONLY those with attendance records)
      let loadedStudentIds: string[] = [];
      try {
        const attData = await api.getAttendance(lessonData.course_id, lessonData.date, lessonData.id);
        const statusMap: Record<string, string> = {};
        const commentMap: Record<string, string> = {};
        for (const record of attData.attendance) {
          statusMap[record.student_id] = record.status;
          if (record.comment) commentMap[record.student_id] = record.comment;
        }
        setAttendanceMap(statusMap);
        setCommentsMap(commentMap);
        loadedStudentIds = Object.keys(statusMap);
      } catch (e) {
        console.error('Failed to load attendance:', e);
      }

      // Load ONLY students who have attendance records for this lesson
      if (loadedStudentIds.length > 0) {
        try {
          const studentPromises = loadedStudentIds.map(id =>
            api.getStudent(id).catch(() => null as any)
          );
          const studentsData = await Promise.all(studentPromises);
          const validStudents = studentsData.filter(Boolean);
          setStudents(validStudents);

          // Load achievements for each student
          const achPromises = validStudents.map(async (s: Student) => {
            try {
              const achData = await api.getAchievements(s.id);
              return { studentId: s.id, achievements: achData.achievements };
            } catch { return { studentId: s.id, achievements: [] }; }
          });
          const achResults = await Promise.all(achPromises);
          const achMap: Record<string, Achievement[]> = {};
          for (const r of achResults) {
            achMap[r.studentId] = r.achievements;
          }
          setAchievementsMap(achMap);
        } catch (e) {
          console.error('Failed to load students:', e);
        }
      } else {
        setStudents([]);
        setAchievementsMap({});
      }

      setError(null);
    } catch (e) {
      console.error('Failed to load lesson:', e);
      setError('Не удалось загрузить занятие');
    } finally {
      setLoading(false);
    }
  };

  // ── Lesson status management ────────────────────────────────────────────
  const handleStatusChange = (status: string) => {
    if (!lesson) return;
    setShowStatusMenu(false);
    if (status === 'cancelled') {
      // Show cancel confirmation modal
      setCancelAction('cancelled');
      setShowCancelModal(true);
    } else if (status === 'rescheduled') {
      // Show reschedule modal directly
      setCancelAction('rescheduled');
      openRescheduleModal();
    } else {
      // Direct status change for 'scheduled'
      doStatusChange(status);
    }
  };

  const doStatusChange = async (status: string) => {
    if (!lesson) return;
    try {
      await api.updateLesson(lesson.id, { status });
      setLessonStatus(status);
    } catch (e) {
      console.error('Failed to update lesson status:', e);
    }
  };

  // ── Cancel lesson: option 1 - today make-up ───────────────────────────
  const handleCancelToday = async () => {
    if (!lesson) return;
    setCancelSaving(true);
    try {
      const todayStr = getTodayDate();
      const startTime = lesson.start_time || lesson.time || '';
      const endTime = lesson.end_time || '';
      // 1. Create a new make-up lesson for today
      const newLesson = await api.createLesson({
        course_id: lesson.course_id,
        date: todayStr,
        time: startTime || undefined,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        title: `Отработка: ${lesson.title}`,
        lesson_type: 'make_up',
        status: 'scheduled',
        note: `Отработка отменённого занятия от ${lesson.date}`,
        location: lesson.location || undefined,
        location_link: lesson.location_link || undefined,
      });
      // 2. Update original lesson as cancelled with rescheduled_to
      await api.updateLesson(lesson.id, {
        status: 'cancelled',
        rescheduled_to: newLesson.id,
      });
      setLessonStatus('cancelled');
      setShowCancelModal(false);
      // Navigate to the new make-up lesson
      navigate(`/lesson/${newLesson.id}`);
    } catch (e) {
      console.error('Failed to reschedule:', e);
      alert('Ошибка при переносе занятия');
    } finally {
      setCancelSaving(false);
    }
  };

  // ── Cancel lesson: option 2 - mark cancelled, save to localStorage ────
  const handleCancelMarkLater = async () => {
    if (!lesson) return;
    setCancelSaving(true);
    try {
      await api.updateLesson(lesson.id, { status: 'cancelled' });
      // Save reminder to localStorage
      const reminder = {
        id: 'rem_' + Date.now(),
        lesson_id: lesson.id,
        course_id: lesson.course_id,
        title: lesson.title || 'Занятие',
        original_date: lesson.date,
      time: lesson.start_time || lesson.time || '',
      start_time: lesson.start_time || lesson.time || '',
      end_time: lesson.end_time || '',
      created_at: new Date().toISOString(),
      type: 'cancelled_mark_later',
    };
    const existing = JSON.parse(localStorage.getItem('edu_pulse_reminders') || '[]');
    existing.push(reminder);
    localStorage.setItem('edu_pulse_reminders', JSON.stringify(existing));

      setLessonStatus('cancelled');
      setShowCancelModal(false);
    } catch (e) {
      console.error('Failed to cancel lesson:', e);
      alert('Ошибка при отмене занятия');
    } finally {
      setCancelSaving(false);
    }
  };

  // ── Reschedule modal (for 'Перенести на другой день') ────────────────
  const openRescheduleModal = () => {
    if (!lesson) return;
    setRescheduleDate('');
    setRescheduleTime(lesson.time || '');
    setRescheduleConflict(null);
    setShowRescheduleModal(true);
  };

  const handleRescheduleConfirm = async () => {
    if (!lesson || !rescheduleDate) return;
    setRescheduleSaving(true);
    try {
      const startTime = lesson.start_time || lesson.time || '';
      const endTime = lesson.end_time || '';
      // 1. Create a new make-up lesson
      const newLesson = await api.createLesson({
        course_id: lesson.course_id,
        date: rescheduleDate,
        time: rescheduleTime || startTime || undefined,
        start_time: rescheduleTime || startTime || undefined,
        end_time: endTime || undefined,
        title: `Отработка: ${lesson.title}`,
        lesson_type: 'make_up',
        status: 'scheduled',
        note: `Отработка отменённого занятия от ${lesson.date}`,
        location: lesson.location || undefined,
        location_link: lesson.location_link || undefined,
      });
      // 2. Update original lesson as cancelled with rescheduled_to
      await api.updateLesson(lesson.id, {
        status: 'cancelled',
        rescheduled_to: newLesson.id,
      });
      setLessonStatus('cancelled');
      setShowRescheduleModal(false);
      // Navigate to the new make-up lesson
      navigate(`/lesson/${newLesson.id}`);
    } catch (e) {
      console.error('Failed to reschedule:', e);
      alert('Ошибка при переносе занятия');
    } finally {
      setRescheduleSaving(false);
    }
  };

  const handleHomeworkSave = async () => {
    if (!lesson) return;
    try {
      await api.updateLesson(lesson.id, { homework: homeworkDraft });
      setHomework(homeworkDraft);
      setShowHomeworkEdit(false);
    } catch (e) {
      console.error('Failed to save homework:', e);
    }
  };

  // ── Group management ────────────────────────────────────────────────
  const openGroupManagement = () => {
    if (!lesson) return;
    setShowGroupManagement(true);
  };

  const handleRemoveStudent = async (studentId: string, attendanceRecordId?: string) => {
    if (!lesson) return;

    // Find attendance record ID for this student
    let recordId = attendanceRecordId;
    if (!recordId) {
      try {
        const attData = await api.getAttendance(lesson.course_id, lesson.date, lesson.id);
        if (attData.attendance.length > 0) {
          recordId = attData.attendance[0].id;
        }
      } catch { /* ignore */ }
    }

    if (!recordId) {
      // If no record found, just remove from local state
      setStudents(prev => prev.filter(s => s.id !== studentId));
      setAttendanceMap(prev => {
        const newMap = { ...prev };
        delete newMap[studentId];
        return newMap;
      });
      return;
    }

    setRemovingStudent(studentId);
    try {
      await api.deleteAttendance(recordId);
      // Remove from local state
      setStudents(prev => prev.filter(s => s.id !== studentId));
      setAttendanceMap(prev => {
        const newMap = { ...prev };
        delete newMap[studentId];
        return newMap;
      });
    } catch (e) {
      console.error('Failed to remove student:', e);
      alert('❌ Ошибка при удалении ученика');
    } finally {
      setRemovingStudent(null);
    }
  };

  // ── Attendance ──────────────────────────────────────────────────────────
  const handleAttendance = useCallback(async (studentId: string, status: string) => {
    if (!lesson) return;
    setSavingStudent(studentId);
    try {
      await api.markAttendance({
        date: lesson.date,
        course_id: lesson.course_id,
        lesson_id: lesson.id,
        student_id: studentId,
        status,
        comment: commentsMap[studentId] || '',
      });
      setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
    } catch (e) {
      console.error('Failed to mark attendance:', e);
    } finally {
      setTimeout(() => setSavingStudent(null), 300);
    }
  }, [lesson, commentsMap]);

  // ── Achievement management ───────────────────────────────────────────
  const handleAddAchievement = async (studentId: string) => {
    if (!newAchievement.title.trim()) return;
    setSavingAchievement(true);
    try {
      const result = await api.createAchievement({
        student_id: studentId,
        title: newAchievement.title,
        icon: newAchievement.icon,
        description: newAchievement.description,
      });
      setAchievementsMap(prev => ({
        ...prev,
        [studentId]: [...(prev[studentId] || []), result],
      }));
      setNewAchievement({ icon: '🏆', title: '', description: '' });
      setShowAddAchievement(null);
    } catch (e) {
      console.error('Failed to create achievement:', e);
    } finally {
      setSavingAchievement(false);
    }
  };

  const handleCommentChange = useCallback((studentId: string, comment: string) => {
    if (!lesson) return;
    setCommentsMap(prev => ({ ...prev, [studentId]: comment }));
    if (!attendanceMap[studentId]) return;

    if (commentTimers.current[studentId]) clearTimeout(commentTimers.current[studentId]);
    commentTimers.current[studentId] = setTimeout(async () => {
      try {
        await api.markAttendance({
          date: lesson.date,
          course_id: lesson.course_id,
          lesson_id: lesson.id,
          student_id: studentId,
          status: attendanceMap[studentId],
          comment,
        });
      } catch (e) {
        console.error('Failed to save comment:', e);
      }
    }, 1500);
  }, [lesson, attendanceMap]);

  // ── Search existing students ────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.length < 1) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchStudents(value);
        // Don't filter by course enrollment — show all matching students.
        // But do filter out students already added to THIS lesson.
        const alreadyAddedIds = new Set(Object.keys(attendanceMap));
        setSearchResults(data.students.filter(s => !alreadyAddedIds.has(s.id)));
      } catch (e) { console.error('Search failed:', e); }
      finally { setSearching(false); }
    }, 300);
  };

  // ── Add existing student to this lesson (mark attendance only) ────────
  const handleEnrollExisting = async (studentId: string) => {
    if (!lesson) return;
    if (!lesson.course_id) {
      alert('❌ У этого занятия нет курса. Чтобы записать ученика, сначала привяжите занятие к курсу через редактирование.');
      return;
    }
    setAddingStudent(true);
    try {
      // Just mark attendance — no course enrollment (different time slots = different students)
      await api.markAttendance({
        date: lesson.date,
        course_id: lesson.course_id,
        lesson_id: lesson.id,
        student_id: studentId,
        status: 'trial',
        comment: 'Пробное занятие',
      });
      setAttendanceMap(prev => ({ ...prev, [studentId]: 'trial' }));
      setCommentsMap(prev => ({ ...prev, [studentId]: 'Пробное занятие' }));

      // Add student to the local list immediately
      try {
        const studentData = await api.getStudent(studentId);
        setStudents(prev => {
          if (prev.some(s => s.id === studentId)) return prev;
          return [...prev, studentData];
        });
      } catch { /* ignore */ }

      setShowAddStudent(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (e) {
      console.error('Failed to enroll student:', e);
      alert('❌ Ошибка при записи ученика.');
    } finally { setAddingStudent(false); }
  };

  // ── Add new student ─────────────────────────────────────────────────────
  const handleAddStudent = async () => {
    const errors = validateStudentForm({ ...newStudent, age: '' });
    setNewStudentErrors(errors);
    if (hasErrors(errors)) return;

    if (!lesson) return;
    if (!lesson.course_id) {
      alert('❌ У этого занятия нет курса. Чтобы добавить ученика, сначала привяжите занятие к курсу через редактирование.');
      return;
    }
    setAddingStudent(true);
    try {
      const created = await api.createStudent({
        first_name: newStudent.first_name,
        last_name: newStudent.last_name,
        phone: newStudent.phone || undefined,
        // Don't auto-enroll in the course — just mark attendance for this lesson
        course_ids: '',
      });

      await api.markAttendance({
        date: lesson.date,
        course_id: lesson.course_id,
        lesson_id: lesson.id,
        student_id: created.id,
        status: 'trial',
        comment: 'Пробное занятие',
      });
      setAttendanceMap(prev => ({ ...prev, [created.id]: 'trial' }));
      setCommentsMap(prev => ({ ...prev, [created.id]: 'Пробное занятие' }));

      // Add student to the local list
      setStudents(prev => [...prev, created]);

      setShowAddStudent(false);
      setNewStudent({ first_name: '', last_name: '', phone: '' });
      setNewStudentErrors({});
    } catch (e) {
      console.error('Failed to add student:', e);
      alert('❌ Ошибка при добавлении ученика.');
    }
    finally { setAddingStudent(false); }
  };

  // ── Stats ───────────────────────────────────────────────────────────────
  const markedCount = Object.keys(attendanceMap).length;
  const presentCount = Object.values(attendanceMap).filter(s => s === 'present').length;
  const trialCount = Object.values(attendanceMap).filter(s => s === 'trial').length;
  const lateCount = Object.values(attendanceMap).filter(s => s === 'late').length;
  const absentCount = Object.values(attendanceMap).filter(s => s === 'absent').length;
  const unmarkedCount = students.length - markedCount;

  const getStatusInfo = (studentId: string) => {
    const statusKey = attendanceMap[studentId];
    return STATUSES.find(s => s.key === statusKey) || null;
  };

  const lessonStatusInfo = LESSON_STATUSES.find(s => s.key === lessonStatus);

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="skeleton h-6 w-20 mb-2" />
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="skeleton h-12 w-full rounded-2xl" />
        <div className="skeleton h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="p-4 animate-fade-in">
        <button onClick={() => navigate(-1)} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Назад
        </button>
        <div className="tg-card flex flex-col items-center py-8">
          <span className="text-4xl mb-3">😔</span>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mb-4">{error || 'Занятие не найдено'}</p>
          <button onClick={() => navigate('/')} className="tg-button text-sm">На главную</button>
        </div>
      </div>
    );
  }

  const lessonTitle = lesson.title || course?.title || 'Занятие';
  const lessonTime = getTimeDisplay(lesson);
  const lessonStartTime = lesson.start_time || lesson.time || '';
  const lessonEndTime = lesson.end_time || '';
  const lessonLocation = lesson.location || course?.location || '';
  const lessonLocationLink = lesson.location_link || course?.location_link || '';
  const lessonColor = course?.color || '#6C5CE7';

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-24">
      {/* ── Back button ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm text-[var(--tg-theme-button-color)] flex items-center gap-1 hover:opacity-80 transition-opacity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Назад
        </button>
        <div className="flex items-center gap-2">
          {permissions.canEditStudents && (
            <button onClick={openGroupManagement}
              className="text-xs px-2.5 py-1 rounded-full font-medium border flex items-center gap-1 hover:bg-[var(--tg-theme-button-color)]/10 transition-colors">
              👥 Группа
            </button>
          )}
          {permissions.canEditStudents && (
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border flex items-center gap-1 ${
                  lessonStatus === 'scheduled' ? 'bg-green-50 text-green-600 border-green-200' :
                  lessonStatus === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
                  'bg-amber-50 text-amber-600 border-amber-200'
                }`}
              >
                {lessonStatusInfo?.icon} {lessonStatusInfo?.label || lessonStatus}
              </button>
              {showStatusMenu && (
                <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-lg border z-10 overflow-hidden min-w-[140px]">
                  {LESSON_STATUSES.map(s => (
                    <button
                      key={s.key}
                      onClick={() => handleStatusChange(s.key)}
                      className={`w-full px-3 py-2.5 text-xs font-medium text-left hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                        lessonStatus === s.key ? 'bg-gray-50 font-semibold' : ''
                      }`}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Lesson Hero ──────────────────────────────────────────────── */}
      <div className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-lg ${lessonStatus === 'cancelled' ? 'opacity-70 grayscale' : ''}`}
        style={{ backgroundColor: lessonColor }}>
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{lessonTitle}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-2xl font-bold">{lessonTime}</span>
                <span className="text-sm text-white/70">{lesson.date}</span>
              </div>
              {lessonStartTime && lessonEndTime && (
                <span className="text-[10px] text-white/50 block mt-0.5">
                  ⏱ {lessonStartTime} — {lessonEndTime}
                </span>
              )}
              {course?.title && course.title !== lessonTitle && (
                <span className="text-xs text-white/60 mt-0.5 block">
                  {course.title}
                </span>
              )}
              {lessonStatus === 'cancelled' && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-red-500/30 text-xs font-semibold">
                  ❌ Занятие отменено
                </span>
              )}
              {lessonStatus === 'rescheduled' && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-amber-500/30 text-xs font-semibold">
                  🔄 Занятие перенесено
                </span>
              )}
            </div>
            <div className="text-right shrink-0 ml-3">
              <span className="text-3xl font-bold">{students.length}</span>
              <p className="text-[10px] text-white/70">учеников</p>
            </div>
          </div>

          {/* Location */}
          {(lessonLocation || lessonLocationLink) && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="flex items-center gap-2">
                <span>📍</span>
                <div className="flex-1 min-w-0">
                  {lessonLocationLink ? (
                    <a href={lessonLocationLink} target="_blank" rel="noopener noreferrer"
                      className="text-sm underline underline-offset-2 hover:opacity-80 transition-opacity">
                      {lessonLocation || 'Открыть в навигаторе'}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline ml-1 -mt-0.5">
                        <path d="M7 17L17 7" /><path d="M7 7h10v10" />
                      </svg>
                    </a>
                  ) : (
                    <span className="text-sm">{lessonLocation}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Homework section ──────────────────────────────────────────── */}
      {lessonStatus !== 'cancelled' && (
        <div className="tg-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">📝 Домашнее задание</h3>
            {permissions.canEditStudents && !showHomeworkEdit && (
              <button onClick={() => { setHomeworkDraft(homework); setShowHomeworkEdit(true); }}
                className="text-xs text-[var(--tg-theme-button-color)]">✏️</button>
            )}
          </div>
          {showHomeworkEdit ? (
            <div className="space-y-2">
              <textarea value={homeworkDraft} onChange={e => setHomeworkDraft(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 resize-none min-h-[60px]"
                placeholder="Напишите домашнее задание..." />
              <div className="flex gap-2">
                <button onClick={() => setShowHomeworkEdit(false)} className="tg-button-secondary flex-1 text-xs">Отмена</button>
                <button onClick={handleHomeworkSave} className="tg-button flex-1 text-xs">Сохранить</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--tg-theme-hint-color)]">{homework || 'Нет задания'}</p>
          )}
        </div>
      )}

      {/* ── Lesson note section ───────────────────────────────────────── */}
      {lessonStatus !== 'cancelled' && lesson.note && (
        <div className="tg-card">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">📌</span>
            <h3 className="text-sm font-semibold">Заметка</h3>
          </div>
          <p className="text-sm text-[var(--tg-theme-text-color)]">{lesson.note}</p>
        </div>
      )}

      {/* ── Attendance stats bar ──────────────────────────────────────── */}
      {lessonStatus !== 'cancelled' && (
        <>
          <div className="grid grid-cols-5 gap-1.5">
            <div className="text-center py-2 px-1 rounded-xl bg-green-50 border border-green-100">
              <span className="text-base font-bold text-green-600">{presentCount}</span>
              <p className="text-[8px] text-green-500">✅</p>
            </div>
            <div className="text-center py-2 px-1 rounded-xl bg-purple-50 border border-purple-100">
              <span className="text-base font-bold text-purple-600">{trialCount}</span>
              <p className="text-[8px] text-purple-500">🌟</p>
            </div>
            <div className="text-center py-2 px-1 rounded-xl bg-amber-50 border border-amber-100">
              <span className="text-base font-bold text-amber-600">{lateCount}</span>
              <p className="text-[8px] text-amber-500">⏰</p>
            </div>
            <div className="text-center py-2 px-1 rounded-xl bg-red-50 border border-red-100">
              <span className="text-base font-bold text-red-600">{absentCount}</span>
              <p className="text-[8px] text-red-500">❌</p>
            </div>
            <div className={`text-center py-2 px-1 rounded-xl border ${unmarkedCount > 0 ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-100'}`}>
              <span className={`text-base font-bold ${unmarkedCount > 0 ? 'text-gray-500' : 'text-green-600'}`}>{unmarkedCount}</span>
              <p className={`text-[8px] ${unmarkedCount > 0 ? 'text-gray-400' : 'text-green-500'}`}>{unmarkedCount > 0 ? 'Осталось' : '✅'}</p>
            </div>
          </div>

          {/* ── Students list ────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--tg-theme-text-color)]">Ученики</h3>
              <button onClick={() => setShowAddStudent(true)}
                className="text-xs font-medium text-[var(--tg-theme-button-color)] flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Добавить
              </button>
            </div>

            {students.length === 0 && (
              <div className="tg-card flex flex-col items-center py-6 text-center">
                <span className="text-3xl mb-2">👨‍🎓</span>
                <p className="text-sm text-[var(--tg-theme-hint-color)] mb-3">Нет учеников на этом занятии</p>
                <button onClick={() => setShowAddStudent(true)} className="tg-button text-sm py-2 px-4">+ Добавить ученика</button>
              </div>
            )}

            {students.map(student => {
              const currentStatus = attendanceMap[student.id];
              const isSaving = savingStudent === student.id;
              const statusInfo = getStatusInfo(student.id);
              const studentAchievements = achievementsMap[student.id] || [];
              const isExpanded = expandedAchievements[student.id];

              return (
                <div key={student.id}
                  className={`tg-card !p-3 transition-all duration-200 ${currentStatus ? (
                    currentStatus === 'present' ? 'ring-1 ring-green-200' :
                    currentStatus === 'trial' ? 'ring-1 ring-purple-200' :
                    currentStatus === 'late' ? 'ring-1 ring-amber-200' : 'ring-1 ring-red-200'
                  ) : ''}`}>
                  <div className="flex items-center gap-3 mb-2.5">
                    <button onClick={() => navigate(`/student/${student.id}`)}
                      className="w-full flex items-center gap-3 text-left active:scale-[0.99] transition-transform min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[var(--tg-theme-button-color)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {student.first_name?.[0] || '?'}{student.last_name?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[var(--tg-theme-text-color)] block truncate">{student.first_name} {student.last_name}</span>
                        {student.phone && <span className="text-[10px] text-[var(--tg-theme-hint-color)]">{student.phone}</span>}
                      </div>
                      {currentStatus && !isSaving && <span className="text-[10px] text-green-500 font-medium shrink-0 ml-1">✓ {statusInfo?.label}</span>}
                      {isSaving && <span className="text-[10px] text-[var(--tg-theme-hint-color)] animate-pulse shrink-0">···</span>}
                    </button>
                    {permissions.canEditStudents && (
                      <button onClick={() => setShowAddAchievement(student.id)}
                        className="shrink-0 w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-xs hover:bg-amber-100 transition-all active:scale-90"
                        title="Добавить достижение">
                        🏆
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1">
                    {STATUSES.map(({ key, label, icon, color }) => {
                      const isActive = currentStatus === key;
                      const colorMap: Record<string, string> = {
                        green: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100',
                        purple: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100',
                        amber: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100',
                        red: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
                      };
                      const activeColorMap: Record<string, string> = {
                        green: 'bg-green-500 text-white shadow-md shadow-green-500/30',
                        purple: 'bg-purple-500 text-white shadow-md shadow-purple-500/30',
                        amber: 'bg-amber-500 text-white shadow-md shadow-amber-500/30',
                        red: 'bg-red-500 text-white shadow-md shadow-red-500/30',
                      };
                      return (
                        <button key={key} onClick={() => handleAttendance(student.id, key)} disabled={isSaving}
                          className={`flex-1 py-2 rounded-lg font-semibold text-[11px] transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                            isActive ? (activeColorMap[color] || activeColorMap.green) + ' scale-[1.02]' :
                            currentStatus ? 'bg-gray-100 text-gray-400 opacity-50' : colorMap[color] || colorMap.green
                          }`}>
                          {icon} {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Student achievements ──────────────────────────────── */}
                  {studentAchievements.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--tg-theme-section-separator-color)]">
                      <button
                        onClick={() => setExpandedAchievements(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                        className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--tg-theme-hint-color)] hover:text-amber-600 transition-colors">
                        🏆 Достижения ({studentAchievements.length})
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {studentAchievements.map(a => (
                            <div key={a.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[10px] font-medium text-amber-700">
                              <span>{a.icon}</span>
                              <span>{a.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Add achievement modal ────────────────────────── */}
                  {showAddAchievement === student.id && (
                    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in"
                      onClick={() => { setShowAddAchievement(null); setNewAchievement({ icon: '🏆', title: '', description: '' }); }}>
                      <div className="w-full max-w-sm bg-[var(--tg-theme-bg-color)] rounded-3xl p-5 shadow-2xl animate-slide-up"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-semibold flex items-center gap-2">
                            🏆 Достижение
                            <span className="text-xs font-normal text-[var(--tg-theme-hint-color)]">
                              {student.first_name} {student.last_name}
                            </span>
                          </h3>
                          <button onClick={() => { setShowAddAchievement(null); setNewAchievement({ icon: '🏆', title: '', description: '' }); }}
                            className="p-1 text-[var(--tg-theme-hint-color)] hover:text-[var(--tg-theme-text-color)] transition-colors">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>

                        {/* Icon picker */}
                        <div className="mb-3">
                          <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1.5 block">Иконка</label>
                          <div className="flex flex-wrap gap-1.5">
                            {ACHIEVEMENT_ICONS.map(icon => (
                              <button key={icon} onClick={() => setNewAchievement(a => ({ ...a, icon }))}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-all ${
                                  newAchievement.icon === icon
                                    ? 'border-amber-400 bg-amber-50 shadow-sm scale-110'
                                    : 'border-transparent hover:bg-gray-50'
                                }`}>
                                {icon}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Title */}
                        <div className="mb-3">
                          <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1 block">Название *</label>
                          <input value={newAchievement.title}
                            onChange={e => setNewAchievement(a => ({ ...a, title: e.target.value }))}
                            placeholder="Собрал робота Горилла"
                            className="w-full px-3 py-2.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/30"
                            autoFocus />
                        </div>

                        {/* Description */}
                        <div className="mb-4">
                          <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1 block">Описание (необязательно)</label>
                          <textarea value={newAchievement.description}
                            onChange={e => setNewAchievement(a => ({ ...a, description: e.target.value }))}
                            placeholder="Например: самостоятельно собрал модель"
                            className="w-full px-3 py-2 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 resize-none min-h-[50px]" />
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => { setShowAddAchievement(null); setNewAchievement({ icon: '🏆', title: '', description: '' }); }}
                            className="tg-button-secondary flex-1 text-sm">Отмена</button>
                          <button onClick={() => handleAddAchievement(student.id)}
                            disabled={savingAchievement || !newAchievement.title.trim()}
                            className="tg-button flex-1 text-sm disabled:opacity-50">
                            {savingAchievement ? '⏳...' : '✅ Сохранить'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Lesson cancelled state ──────────────────────────────────────── */}
      {lessonStatus === 'cancelled' && (
        <div className="tg-card flex flex-col items-center py-8 text-center">
          <span className="text-5xl mb-3">😴</span>
          <p className="text-base font-semibold text-[var(--tg-theme-text-color)] mb-1">Занятие отменено</p>
          <p className="text-sm text-[var(--tg-theme-hint-color)]">Отметки и посещаемость не требуются</p>
          {permissions.canEditStudents && (
            <button onClick={() => doStatusChange('scheduled')}
              className="mt-4 tg-button text-sm">Восстановить занятие</button>
          )}
        </div>
      )}

      {/* ── Group Management Modal ──────────────────────────────────── */}
      {showGroupManagement && lesson && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowGroupManagement(false)}>
          <div className="w-full max-w-lg bg-[var(--tg-theme-bg-color)] rounded-3xl p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">👥 Управление группой</h3>
              <button onClick={() => setShowGroupManagement(false)} className="p-1 text-[var(--tg-theme-hint-color)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Lesson info */}
            <div className="mb-4 p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)]">
              <p className="text-sm font-semibold text-[var(--tg-theme-text-color)]">{lesson.title || course?.title || 'Занятие'}</p>
              <p className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5">
                {lesson.date} · {getTimeDisplay(lesson)} · {students.length} {students.length === 1 ? 'ученик' : 'учеников'}
              </p>
            </div>

            {/* Students list */}
            <div className="space-y-1.5 mb-4">
              <p className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-2">
                Ученики на этом занятии
              </p>
              {students.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <span className="text-3xl mb-2">👨‍🎓</span>
                  <p className="text-sm text-[var(--tg-theme-hint-color)]">Нет учеников в группе</p>
                </div>
              ) : (
                students.map(student => {
                  const isRemoving = removingStudent === student.id;
                  const statusLabel = attendanceMap[student.id]
                    ? STATUSES.find(s => s.key === attendanceMap[student.id])?.label || attendanceMap[student.id]
                    : '—';
                  return (
                    <div key={student.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isRemoving ? 'opacity-50' : 'hover:bg-[var(--tg-theme-secondary-bg-color)]'}`}>
                      <div className="w-9 h-9 rounded-full bg-[var(--tg-theme-button-color)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {student.first_name?.[0] || '?'}{student.last_name?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[var(--tg-theme-text-color)] block truncate">
                          {student.first_name} {student.last_name}
                        </span>
                        <span className="text-[10px] text-[var(--tg-theme-hint-color)]">
                          {attendanceMap[student.id] ? `${STATUSES.find(s => s.key === attendanceMap[student.id])?.icon || ''} ${statusLabel}` : '📝 Не отмечен'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveStudent(student.id)}
                        disabled={isRemoving}
                        className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-all active:scale-90 disabled:opacity-50"
                        title="Удалить из занятия"
                      >
                        {isRemoving ? '⏳' : '❌ Удалить'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add student section */}
            <div className="pt-3 border-t border-[var(--tg-theme-section-separator-color)]">
              <button
                onClick={() => { setShowGroupManagement(false); setShowAddStudent(true); }}
                className="w-full py-3 rounded-xl text-sm font-medium text-[var(--tg-theme-button-color)] bg-[var(--tg-theme-secondary-bg-color)] hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Добавить ученика
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Modal ──────────────────────────────────── */}
      {showCancelModal && lesson && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowCancelModal(false)}>
          <div className="bg-[var(--tg-theme-bg-color)] rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}>

            <div className="text-center mb-5">
              <span className="text-5xl block mb-3">🤔</span>
              <h3 className="text-lg font-bold text-[var(--tg-theme-text-color)] mb-1">
                Когда проведём отменённое занятие?
              </h3>
              <p className="text-xs text-[var(--tg-theme-hint-color)]">
                {lesson.title} · {lesson.date} {lesson.time}
              </p>
            </div>

            <div className="space-y-2">
              {/* Option: Today */}
              <button
                onClick={handleCancelToday}
                disabled={cancelSaving}
                className="w-full text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-50 border-green-200 bg-green-50 hover:border-green-300"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <span className="text-sm font-semibold text-green-800 block">Проведём сегодня</span>
                    <span className="text-[11px] text-green-600">Создать отработку на сегодня</span>
                  </div>
                </div>
              </button>

              {/* Option: Reschedule */}
              <button
                onClick={() => { setShowCancelModal(false); openRescheduleModal(); }}
                disabled={cancelSaving}
                className="w-full text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-50 border-amber-200 bg-amber-50 hover:border-amber-300"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <span className="text-sm font-semibold text-amber-800 block">Перенести на другой день</span>
                    <span className="text-[11px] text-amber-600">Выбрать новую дату и время</span>
                  </div>
                </div>
              </button>

              {/* Option: Mark later */}
              <button
                onClick={handleCancelMarkLater}
                disabled={cancelSaving}
                className="w-full text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-50 border-purple-200 bg-purple-50 hover:border-purple-300"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <span className="text-sm font-semibold text-purple-800 block">Отмечу позже</span>
                    <span className="text-[11px] text-purple-600">Напомнить в Inbox (Важные)</span>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowCancelModal(false)}
              className="w-full mt-4 py-3 rounded-xl text-sm text-[var(--tg-theme-hint-color)] hover:opacity-70 transition-opacity"
            >
              Назад
            </button>
          </div>
        </div>
      )}

      {/* ── Reschedule Modal (date/time picker) ─────────────────────────── */}
      {showRescheduleModal && lesson && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowRescheduleModal(false)}>
          <div className="bg-[var(--tg-theme-bg-color)] rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">🔄 Перенести занятие</h3>
              <button onClick={() => setShowRescheduleModal(false)}
                className="p-1 text-[var(--tg-theme-hint-color)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-xs font-semibold text-amber-800">{lesson.title}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">
                Отменяется {lesson.date} в {lesson.time || '—'}
              </p>
            </div>

            <div className="mb-3">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1 block">📆 Новая дата *</label>
              <input type="date" value={rescheduleDate}
                onChange={e => {
                  setRescheduleDate(e.target.value);
                  checkLessonConflict(e.target.value, rescheduleTime);
                }}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--tg-theme-hint-color)] mb-1 block">⏰ Новое время</label>
              <input type="time" value={rescheduleTime}
                onChange={e => {
                  setRescheduleTime(e.target.value);
                  checkLessonConflict(rescheduleDate, e.target.value);
                }}
                className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2" />
            </div>

            {rescheduleConflict && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>{rescheduleConflict}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowRescheduleModal(false)}
                className="tg-button-secondary flex-1 text-sm">Отмена</button>
              <button onClick={handleRescheduleConfirm}
                disabled={rescheduleSaving || !rescheduleDate || !!rescheduleConflict}
                className="tg-button flex-1 text-sm disabled:opacity-50">
                {rescheduleSaving ? '⏳ Перенос...' : '✅ Перенести'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Student Modal ─────────────────────────────────────────── */}
      {showAddStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => { setShowAddStudent(false); setAddMode('new'); }}>
          <div className="w-full max-w-lg bg-[var(--tg-theme-bg-color)] rounded-3xl p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Добавить ученика</h3>
              <button onClick={() => setShowAddStudent(false)} className="p-1 text-[var(--tg-theme-hint-color)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="flex gap-1 mb-4 p-0.5 rounded-xl bg-[var(--tg-theme-secondary-bg-color)]">
              <button onClick={() => setAddMode('existing')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${addMode === 'existing' ? 'bg-white text-[var(--tg-theme-text-color)] shadow-sm' : 'text-[var(--tg-theme-hint-color)]'}`}>
                🔍 Существующий
              </button>
              <button onClick={() => setAddMode('new')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${addMode === 'new' ? 'bg-white text-[var(--tg-theme-text-color)] shadow-sm' : 'text-[var(--tg-theme-hint-color)]'}`}>
                ✨ Новый ученик
              </button>
            </div>

            {addMode === 'existing' ? (
              <div className="space-y-2">
                <input value={searchQuery} onChange={e => handleSearchChange(e.target.value)}
                  placeholder="🔍 Введите имя или фамилию..."
                  className="w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]" autoFocus />
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {searching && <div className="text-center py-4 text-xs text-[var(--tg-theme-hint-color)]">Поиск...</div>}
                  {!searching && searchQuery && searchResults.length === 0 && <div className="text-center py-4 text-xs text-[var(--tg-theme-hint-color)]">Ничего не найдено</div>}
                  {!searching && searchQuery.length === 0 && <div className="text-center py-4 text-xs text-[var(--tg-theme-hint-color)]">Начните вводить имя ученика</div>}
                  {searchResults.map(s => (
                    <button key={s.id} onClick={() => handleEnrollExisting(s.id)} disabled={addingStudent}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--tg-theme-secondary-bg-color)] transition-all active:scale-[0.98] disabled:opacity-50">
                      <div className="w-8 h-8 rounded-full bg-[var(--tg-theme-button-color)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {s.first_name?.[0] || '?'}{s.last_name?.[0] || ''}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <span className="text-sm font-medium block truncate">{s.first_name} {s.last_name}</span>
                        <span className="text-[10px] text-[var(--tg-theme-hint-color)]">{s.phone || s.parent_contact || ''}</span>
                      </div>
                      <span className="text-[10px] font-medium text-[var(--tg-theme-button-color)] shrink-0">+ Записать</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => { setShowAddStudent(false); setAddMode('new'); }} className="tg-button-secondary w-full text-sm">Отмена</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Имя *</label>
                  <input value={newStudent.first_name} onChange={e => { setNewStudent(f => ({ ...f, first_name: e.target.value })); setNewStudentErrors(prev => ({ ...prev, first_name: undefined })); }}
                    placeholder="Иван" autoFocus
                    className={`w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 ${newStudentErrors.first_name ? 'ring-2 ring-red-300' : ''}`} />
                  {newStudentErrors.first_name && <p className="text-xs text-red-500 mt-0.5">{newStudentErrors.first_name}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Фамилия *</label>
                  <input value={newStudent.last_name} onChange={e => { setNewStudent(f => ({ ...f, last_name: e.target.value })); setNewStudentErrors(prev => ({ ...prev, last_name: undefined })); }}
                    placeholder="Петров"
                    className={`w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 ${newStudentErrors.last_name ? 'ring-2 ring-red-300' : ''}`} />
                  {newStudentErrors.last_name && <p className="text-xs text-red-500 mt-0.5">{newStudentErrors.last_name}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--tg-theme-hint-color)]">Телефон</label>
                  <input value={newStudent.phone} onChange={e => { setNewStudent(f => ({ ...f, phone: e.target.value })); setNewStudentErrors(prev => ({ ...prev, phone: undefined })); }}
                    placeholder="+7 999 123-45-67"
                    className={`w-full px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-sm outline-none focus:ring-2 ${newStudentErrors.phone ? 'ring-2 ring-red-300' : ''}`} />
                  {newStudentErrors.phone && <p className="text-xs text-red-500 mt-0.5">{newStudentErrors.phone}</p>}
                </div>

                <p className="text-[10px] text-[var(--tg-theme-hint-color)]">
                  Ученик будет добавлен на этот курс и отмечен как <strong>пробное</strong>
                </p>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowAddStudent(false); setNewStudentErrors({}); }} className="tg-button-secondary flex-1 text-sm">Отмена</button>
                  <button onClick={handleAddStudent} disabled={addingStudent}
                    className="tg-button flex-1 text-sm disabled:opacity-50">
                    {addingStudent ? 'Добавление...' : 'Добавить ✅'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
