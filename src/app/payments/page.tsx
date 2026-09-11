'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { format, addMonths, subMonths } from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  UserPlus, 
  Send,
  X 
} from 'lucide-react';

interface PaymentRow {
  id: string;
  studentId: string;
  studentName: string;
  parentPhone: string | null;
  groupName: string;
  expectedAmount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  paidAt: string | null;
  paymentMethod: string | null;
}

interface GroupOption {
  id: string;
  name: string;
  default_Monthly_Fee: number;
}

export default function PaymentsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const billingPeriod = format(currentDate, 'yyyy-MM');

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('ALL');

  // Modals
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [activePayment, setActivePayment] = useState<PaymentRow | null>(null);
  const [payMethod, setPayMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'DIGITAL_WALLET'>('BANK_TRANSFER');

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [submittingStudent, setSubmittingStudent] = useState(false);

  const fetchLedger = useCallback(async () => {
    setLoading(true);

    // 1. Fetch available groups
    const { data: groupList } = await supabase
      .from('groups')
      .select('id, name, default_monthly_fee')
      .eq('is_active', true);

    if (groupList) setGroups(groupList as any);

    // 2. Hydrate payments for active students in this period
    const { data: activeStudents } = await supabase
      .from('students')
      .select('id, custom_fee, group_id, groups(default_monthly_fee)')
      .eq('is_active', true);

    if (activeStudents && activeStudents.length > 0) {
      const recordsToInsert = activeStudents.map((s: any) => ({
        student_id: s.id,
        billing_period: billingPeriod,
        expected_amount: s.custom_fee ?? s.groups?.default_monthly_fee ?? 0,
        status: 'PENDING',
      }));

      await supabase
        .from('monthly_payments')
        .upsert(recordsToInsert, { onConflict: 'student_id,billing_period', ignoreDuplicates: true });
    }

    // 3. Load all payments for this billing cycle
    const { data, error } = await supabase
      .from('monthly_payments')
      .select(`
        id,
        expected_amount,
        status,
        paid_at,
        payment_method,
        students (
          id,
          full_name,
          parent_phone,
          groups (
            name
          )
        )
      `)
      .eq('billing_period', billingPeriod);

    if (data && !error) {
      const mapped: PaymentRow[] = data.map((item: any) => ({
        id: item.id,
        studentId: item.students?.id,
        studentName: item.students?.full_name ?? 'Unknown Student',
        parentPhone: item.students?.parent_phone ?? null,
        groupName: item.students?.groups?.name ?? 'General Group',
        expectedAmount: item.expected_amount,
        status: item.status,
        paidAt: item.paid_at,
        paymentMethod: item.payment_method,
      }));
      setPayments(mapped);
    }
    setLoading(false);
  }, [billingPeriod]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleMarkPaid = async () => {
    if (!activePayment) return;

    await supabase
      .from('monthly_payments')
      .update({
        status: 'PAID',
        paid_at: new Date().toISOString().split('T')[0],
        payment_method: payMethod,
      })
      .eq('id', activePayment.id);

    setIsPayModalOpen(false);
    setActivePayment(null);
    fetchLedger();
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !selectedGroupId) return;
    setSubmittingStudent(true);

    const { error } = await supabase.from('students').insert({
      full_name: newStudentName,
      parent_phone: newStudentPhone || null,
      group_id: selectedGroupId,
    });

    if (!error) {
      setNewStudentName('');
      setNewStudentPhone('');
      setIsStudentModalOpen(false);
      await fetchLedger();
    }
    setSubmittingStudent(false);
  };

  const sendReminder = (payment: PaymentRow) => {
    const text = encodeURIComponent(
      `Hello, this is a friendly reminder regarding the monthly tutoring fee of $${payment.expectedAmount} for ${payment.studentName} for the period of ${billingPeriod}. Thank you!`
    );
    const phone = payment.parentPhone ? payment.parentPhone.replace(/[^0-9]/g, '') : '';
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  // Metrics
  const totalProjected = payments.reduce((acc, p) => acc + Number(p.expectedAmount), 0);
  const totalCollected = payments
    .filter((p) => p.status === 'PAID')
    .reduce((acc, p) => acc + Number(p.expectedAmount), 0);
  const collectionRate = totalProjected > 0 ? Math.round((totalCollected / totalProjected) * 100) : 0;

  const filtered = payments.filter((p) => (filter === 'ALL' ? true : p.status === filter));

  return (
    <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Ledger</h1>
          <p className="text-sm text-neutral-500">Track monthly group fees</p>
        </div>
        <button
          onClick={() => {
            if (groups.length > 0) setSelectedGroupId(groups[0].id);
            setIsStudentModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-transform"
        >
          <UserPlus className="w-4 h-4" /> Add Student
        </button>
      </header>

      {/* Month Selector Carousel */}
      <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-neutral-200">
        <button
          onClick={() => setCurrentDate((d) => subMonths(d, 1))}
          className="p-1.5 rounded-lg hover:bg-neutral-100 active:scale-95 text-neutral-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-base text-neutral-800">
          {format(currentDate, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentDate((d) => addMonths(d, 1))}
          className="p-1.5 rounded-lg hover:bg-neutral-100 active:scale-95 text-neutral-600"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200 space-y-1">
          <p className="text-xs text-neutral-500 font-medium">Projected</p>
          <p className="text-lg font-bold text-neutral-900">${totalProjected}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200 space-y-1">
          <p className="text-xs text-green-600 font-medium">Collected</p>
          <p className="text-lg font-bold text-green-600">${totalCollected}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200 space-y-1">
          <p className="text-xs text-blue-600 font-medium">Progress</p>
          <p className="text-lg font-bold text-blue-600">{collectionRate}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 text-xs font-semibold overflow-x-auto pb-1">
        {(['ALL', 'PENDING', 'OVERDUE', 'PAID'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === tab
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Student Payment Rows */}
      <section className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-neutral-400">Loading ledger...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-neutral-300">
            <p className="text-neutral-500 font-medium">No records found for this view</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-neutral-900">{item.studentName}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.status === 'PAID'
                        ? 'bg-green-100 text-green-700'
                        : item.status === 'OVERDUE'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">{item.groupName}</p>
                {item.paidAt && (
                  <p className="text-[11px] text-neutral-400">
                    Paid {item.paidAt} via {item.paymentMethod?.replace('_', ' ')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="font-bold text-neutral-900">${item.expectedAmount}</span>

                {item.status !== 'PAID' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setActivePayment(item);
                        setIsPayModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-neutral-900 rounded-lg hover:bg-black active:scale-95 transition"
                    >
                      Record
                    </button>
                    <button
                      onClick={() => sendReminder(item)}
                      title="Send WhatsApp Reminder"
                      className="p-1 text-neutral-400 hover:text-green-600 active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Record Payment Drawer */}
      {isPayModalOpen && activePayment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-neutral-900">Mark Fee as Paid</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm space-y-1">
              <p className="text-neutral-500">Student: <strong className="text-neutral-800">{activePayment.studentName}</strong></p>
              <p className="text-neutral-500">Amount: <strong className="text-neutral-800">${activePayment.expectedAmount}</strong></p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Payment Channel
              </label>
              <select
                value={payMethod}
                onChange={(e: any) => setPayMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="DIGITAL_WALLET">Digital Wallet (Vodafone/PayPal/InstaPay)</option>
              </select>
            </div>

            <button
              onClick={handleMarkPaid}
              className="w-full py-2.5 text-white font-medium bg-green-600 rounded-lg hover:bg-green-700 active:scale-98 transition text-sm"
            >
              Confirm Received
            </button>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-neutral-900">Enroll New Student</h3>
              <button onClick={() => setIsStudentModalOpen(false)} className="text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Omar Tarek"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Parent Phone (for WhatsApp alerts)
                </label>
                <input
                  type="tel"
                  placeholder="+2010..."
                  value={newStudentPhone}
                  onChange={(e) => setNewStudentPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Assign to Teaching Group *
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                  required
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} (${g.default_Monthly_Fee}/mo)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submittingStudent}
                className="w-full py-2.5 text-white font-medium bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-98 transition disabled:opacity-50"
              >
                {submittingStudent ? 'Enrolling...' : 'Enroll Student'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}