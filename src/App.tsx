import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Package, 
  History, 
  Users, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit2,
  X,
  Calculator,
  ChevronRight,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, JackType, Transaction, User, CalculationResult } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'jacks' | 'transactions' | 'users' | 'reports'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [jackTypes, setJackTypes] = useState<JackType[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [projectForm, setProjectForm] = useState({ name: '', location: '' });
  const [jackForm, setJackForm] = useState({ name: '', daily_rate: 0 });
  const [transactionForm, setTransactionForm] = useState({ project_id: 0, jack_type_id: 0, quantity: 0, date: new Date().toISOString().split('T')[0], type: 'IN' as 'IN' | 'OUT' });
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'supervisor' as 'admin' | 'supervisor' });
  const [editingItem, setEditingItem] = useState<{ type: string, data: any } | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('jack_user');
    if (savedUser) setUser(JSON.parse(savedUser));
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pRes, jRes, tRes, uRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/jack-types'),
        fetch('/api/transactions'),
        fetch('/api/users')
      ]);
      setProjects(await pRes.json());
      setJackTypes(await jRes.json());
      setTransactions(await tRes.json());
      setUsers(await uRes.json());
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm)
    });
    if (res.ok) {
      const userData = await res.json();
      setUser(userData);
      localStorage.setItem('jack_user', JSON.stringify(userData));
    } else {
      alert("خطأ في بيانات الدخول");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('jack_user');
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectForm)
    });
    setProjectForm({ name: '', location: '' });
    fetchData();
  };

  const handleAddJack = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/jack-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jackForm)
    });
    setJackForm({ name: '', daily_rate: 0 });
    fetchData();
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transactionForm)
    });
    setTransactionForm({ ...transactionForm, quantity: 0 });
    fetchData();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm)
    });
    if (res.ok) {
      setUserForm({ username: '', password: '', role: 'supervisor' });
      fetchData();
    } else {
      alert("اسم المستخدم موجود بالفعل");
    }
  };

  const handleDelete = async (type: string, id: number) => {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    if (!window.confirm("تأكيد نهائي: هل تريد حقاً حذف هذا العنصر؟ لا يمكن التراجع عن هذه العملية.")) return;
    await fetch(`/api/${type}/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    
    if (!window.confirm("هل أنت متأكد من حفظ التعديلات؟")) return;
    if (!window.confirm("تأكيد نهائي: هل تريد حقاً تعديل هذا العنصر؟")) return;

    const { type, data } = editingItem;
    await fetch(`/api/${type}/${data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setEditingItem(null);
    fetchData();
  };

  // Filter states for reports
  const [reportFilters, setReportFilters] = useState({
    project_id: '',
    jack_type_id: '',
    startDate: '',
    endDate: ''
  });

  // FIFO Calculation Logic
  const rentalReports = useMemo(() => {
    const results: CalculationResult[] = [];
    
    // Group transactions by project and jack type
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      const key = `${t.project_id}-${t.jack_type_id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    Object.values(groups).forEach(group => {
      const ins = group.filter(t => t.type === 'IN').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const outs = group.filter(t => t.type === 'OUT').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Track remaining quantities for each IN transaction
      const inStocks = ins.map(i => ({ ...i, remaining: i.quantity }));

      outs.forEach(out => {
        let needed = out.quantity;
        const outDate = new Date(out.date);

        for (const stock of inStocks) {
          if (needed <= 0) break;
          if (stock.remaining <= 0) continue;

          const taken = Math.min(stock.remaining, needed);
          const inDate = new Date(stock.date);
          
          // Duration calculation: (Exit - Entry) + 1 day
          const diffTime = Math.abs(outDate.getTime() - inDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

          results.push({
            jack_name: stock.jack_name || 'غير معروف',
            project_name: stock.project_name || 'غير معروف',
            quantity: taken,
            entry_date: stock.date,
            exit_date: out.date,
            days: diffDays,
            daily_rate: stock.daily_rate || 0,
            total_cost: taken * diffDays * (stock.daily_rate || 0),
            // Add IDs for filtering
            project_id: stock.project_id,
            jack_type_id: stock.jack_type_id
          } as any);

          stock.remaining -= taken;
          needed -= taken;
        }
      });
    });

    return results;
  }, [transactions]);

  const filteredReports = useMemo(() => {
    return rentalReports.filter((r: any) => {
      const matchProject = !reportFilters.project_id || r.project_id === parseInt(reportFilters.project_id);
      const matchJack = !reportFilters.jack_type_id || r.jack_type_id === parseInt(reportFilters.jack_type_id);
      const matchStart = !reportFilters.startDate || new Date(r.exit_date) >= new Date(reportFilters.startDate);
      const matchEnd = !reportFilters.endDate || new Date(r.exit_date) <= new Date(reportFilters.endDate);
      return matchProject && matchJack && matchStart && matchEnd;
    });
  }, [rentalReports, reportFilters]);

  const handlePrint = () => {
    window.print();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md"
        >
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-600 p-3 rounded-xl">
              <Package className="text-white w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-8 text-slate-800">نظام إدارة الجاكات</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">اسم المستخدم</label>
              <input 
                type="text" 
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور</label>
              <input 
                type="password" 
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                required
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              تسجيل الدخول
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-400">الافتراضي: admin / admin123</p>
        </motion.div>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-l border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Package className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-slate-800">إدارة الجاكات</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20}/>} label="لوحة التحكم" />
          <NavItem active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} icon={<Building2 size={20}/>} label="المشاريع" />
          <NavItem active={activeTab === 'jacks'} onClick={() => setActiveTab('jacks')} icon={<Package size={20}/>} label="أنواع الجاكات" />
          <NavItem active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<History size={20}/>} label="الحركات (دخول/خروج)" />
          <NavItem active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<Calculator size={20}/>} label="تقارير الإيجار" />
          {isAdmin && <NavItem active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={20}/>} label="المستخدمين" />}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="text-sm">
              <p className="font-bold text-slate-800">{user.username}</p>
              <p className="text-xs text-slate-500">{isAdmin ? 'مدير النظام' : 'مشرف'}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-2xl font-bold mb-6 text-slate-800">لوحة التحكم</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="إجمالي المشاريع" value={projects.length} icon={<Building2 className="text-blue-600"/>} color="bg-blue-50" />
                <StatCard label="أنواع الجاكات" value={jackTypes.length} icon={<Package className="text-indigo-600"/>} color="bg-indigo-50" />
                <StatCard label="إجمالي الحركات" value={transactions.length} icon={<History className="text-emerald-600"/>} color="bg-emerald-50" />
              </div>

              <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold mb-4 text-slate-800">آخر الحركات</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="text-slate-400 text-sm border-b border-slate-50">
                        <th className="pb-3 font-medium">التاريخ</th>
                        <th className="pb-3 font-medium">المشروع</th>
                        <th className="pb-3 font-medium">النوع</th>
                        <th className="pb-3 font-medium">الكمية</th>
                        <th className="pb-3 font-medium">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {transactions.slice(-5).reverse().map(t => (
                        <tr key={t.id} className="text-sm text-slate-600">
                          <td className="py-4">{t.date}</td>
                          <td className="py-4 font-medium text-slate-800">{t.project_name}</td>
                          <td className="py-4">{t.jack_name}</td>
                          <td className="py-4">{t.quantity}</td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-full text-xs ${t.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                              {t.type === 'IN' ? 'دخول' : 'خروج'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'projects' && (
            <motion.div key="projects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">المشاريع</h2>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold mb-4 text-slate-800">إضافة مشروع جديد</h3>
                    <form onSubmit={handleAddProject} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">اسم المشروع</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={projectForm.name}
                          onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">الموقع</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={projectForm.location}
                          onChange={e => setProjectForm({ ...projectForm, location: e.target.value })}
                        />
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        <Plus size={18} /> إضافة
                      </button>
                    </form>
                  </div>
                </div>
                
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-right">
                      <thead className="bg-slate-50">
                        <tr className="text-slate-500 text-sm">
                          <th className="p-4 font-medium">الاسم</th>
                          <th className="p-4 font-medium">الموقع</th>
                          {isAdmin && <th className="p-4 font-medium">الإجراءات</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {projects.map(p => (
                          <tr key={p.id} className="text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-slate-800">{p.name}</td>
                            <td className="p-4">{p.location || '-'}</td>
                            {isAdmin && (
                              <td className="p-4 flex gap-2">
                                <button 
                                  onClick={() => setEditingItem({ type: 'projects', data: { ...p } })}
                                  className="text-slate-400 hover:text-indigo-500 transition-colors"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete('projects', p.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'jacks' && (
            <motion.div key="jacks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-2xl font-bold mb-6 text-slate-800">أنواع الجاكات</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold mb-4 text-slate-800">إضافة نوع جديد</h3>
                    <form onSubmit={handleAddJack} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">اسم النوع (مثلاً جاك 3م)</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={jackForm.name}
                          onChange={e => setJackForm({ ...jackForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">سعر الإيجار اليومي</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={jackForm.daily_rate}
                          onChange={e => setJackForm({ ...jackForm, daily_rate: parseFloat(e.target.value) })}
                          required
                        />
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        <Plus size={18} /> إضافة
                      </button>
                    </form>
                  </div>
                </div>
                
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-right">
                      <thead className="bg-slate-50">
                        <tr className="text-slate-500 text-sm">
                          <th className="p-4 font-medium">النوع</th>
                          <th className="p-4 font-medium">سعر الإيجار اليومي</th>
                          {isAdmin && <th className="p-4 font-medium">الإجراءات</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {jackTypes.map(j => (
                          <tr key={j.id} className="text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-slate-800">{j.name}</td>
                            <td className="p-4">{j.daily_rate} ريال</td>
                            {isAdmin && (
                              <td className="p-4 flex gap-2">
                                <button 
                                  onClick={() => setEditingItem({ type: 'jack-types', data: { ...j } })}
                                  className="text-slate-400 hover:text-indigo-500 transition-colors"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete('jack-types', j.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'transactions' && (
            <motion.div key="transactions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-2xl font-bold mb-6 text-slate-800">حركات التوريد والصرف</h2>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold mb-4 text-slate-800">تسجيل حركة</h3>
                    <form onSubmit={handleAddTransaction} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">المشروع</label>
                        <select 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={transactionForm.project_id}
                          onChange={e => setTransactionForm({ ...transactionForm, project_id: parseInt(e.target.value) })}
                          required
                        >
                          <option value="">اختر المشروع</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">نوع الجاك</label>
                        <select 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={transactionForm.jack_type_id}
                          onChange={e => setTransactionForm({ ...transactionForm, jack_type_id: parseInt(e.target.value) })}
                          required
                        >
                          <option value="">اختر النوع</option>
                          {jackTypes.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">الكمية</label>
                        <input 
                          type="number" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={transactionForm.quantity}
                          onChange={e => setTransactionForm({ ...transactionForm, quantity: parseInt(e.target.value) })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
                        <input 
                          type="date" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={transactionForm.date}
                          onChange={e => setTransactionForm({ ...transactionForm, date: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">نوع الحركة</label>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => setTransactionForm({ ...transactionForm, type: 'IN' })}
                            className={`flex-1 py-2 rounded-lg font-bold transition-all ${transactionForm.type === 'IN' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-100 text-slate-500'}`}
                          >
                            دخول (توريد)
                          </button>
                          <button 
                            type="button"
                            onClick={() => setTransactionForm({ ...transactionForm, type: 'OUT' })}
                            className={`flex-1 py-2 rounded-lg font-bold transition-all ${transactionForm.type === 'OUT' ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-slate-100 text-slate-500'}`}
                          >
                            خروج (صرف)
                          </button>
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        <Plus size={18} /> تسجيل
                      </button>
                    </form>
                  </div>
                </div>
                
                <div className="lg:col-span-3">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-right">
                      <thead className="bg-slate-50">
                        <tr className="text-slate-500 text-sm">
                          <th className="p-4 font-medium">التاريخ</th>
                          <th className="p-4 font-medium">المشروع</th>
                          <th className="p-4 font-medium">النوع</th>
                          <th className="p-4 font-medium">الكمية</th>
                          <th className="p-4 font-medium">الحالة</th>
                          {isAdmin && <th className="p-4 font-medium">الإجراءات</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transactions.slice().reverse().map(t => (
                          <tr key={t.id} className="text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                            <td className="p-4">{t.date}</td>
                            <td className="p-4 font-bold text-slate-800">{t.project_name}</td>
                            <td className="p-4">{t.jack_name}</td>
                            <td className="p-4">{t.quantity}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs ${t.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                {t.type === 'IN' ? 'دخول' : 'خروج'}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="p-4 flex gap-2">
                                <button 
                                  onClick={() => setEditingItem({ type: 'transactions', data: { ...t } })}
                                  className="text-slate-400 hover:text-indigo-500 transition-colors"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete('transactions', t.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex justify-between items-center mb-6 no-print">
                <h2 className="text-2xl font-bold text-slate-800">تقارير حساب الإيجار (FIFO)</h2>
                <button 
                  onClick={handlePrint}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 transition-colors flex items-center gap-2"
                >
                  <Calculator size={18} /> طباعة التقرير
                </button>
              </div>

              {/* Filters */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 no-print">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">تصفية بالمشروع</label>
                    <select 
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={reportFilters.project_id}
                      onChange={e => setReportFilters({ ...reportFilters, project_id: e.target.value })}
                    >
                      <option value="">كل المشاريع</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">تصفية بنوع الجاك</label>
                    <select 
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={reportFilters.jack_type_id}
                      onChange={e => setReportFilters({ ...reportFilters, jack_type_id: e.target.value })}
                    >
                      <option value="">كل الأنواع</option>
                      {jackTypes.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">من تاريخ (الخروج)</label>
                    <input 
                      type="date" 
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={reportFilters.startDate}
                      onChange={e => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">إلى تاريخ (الخروج)</label>
                    <input 
                      type="date" 
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={reportFilters.endDate}
                      onChange={e => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden print-area">
                <div className="p-6 border-b border-slate-50 bg-indigo-50/30 no-print">
                  <p className="text-sm text-indigo-700 flex items-center gap-2">
                    <AlertCircle size={16} />
                    يتم حساب التكلفة بناءً على تاريخ الدخول وتاريخ الخروج مع إضافة يوم واحد كما هو مطلوب.
                  </p>
                </div>
                
                {/* Print Header (Only visible when printing) */}
                <div className="hidden print-only p-8 border-b-2 border-slate-800 mb-6">
                  <h1 className="text-3xl font-bold text-center mb-2">تقرير إيجار الجاكات</h1>
                  <div className="flex justify-between text-sm">
                    <p>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
                    <p>المستخدم: {user.username}</p>
                  </div>
                </div>

                <table className="w-full text-right">
                  <thead className="bg-slate-50">
                    <tr className="text-slate-500 text-sm">
                      <th className="p-4 font-medium">المشروع</th>
                      <th className="p-4 font-medium">النوع</th>
                      <th className="p-4 font-medium">الكمية</th>
                      <th className="p-4 font-medium">تاريخ الدخول</th>
                      <th className="p-4 font-medium">تاريخ الخروج</th>
                      <th className="p-4 font-medium">الأيام (+1)</th>
                      <th className="p-4 font-medium">السعر اليومي</th>
                      <th className="p-4 font-medium">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReports.map((r, idx) => (
                      <tr key={idx} className="text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{r.project_name}</td>
                        <td className="p-4">{r.jack_name}</td>
                        <td className="p-4">{r.quantity}</td>
                        <td className="p-4">{r.entry_date}</td>
                        <td className="p-4">{r.exit_date}</td>
                        <td className="p-4">{r.days}</td>
                        <td className="p-4">{r.daily_rate} ريال</td>
                        <td className="p-4 font-bold text-indigo-600">{r.total_cost.toFixed(2)} ريال</td>
                      </tr>
                    ))}
                    {filteredReports.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">لا توجد بيانات مطابقة للفلاتر المختارة</td>
                      </tr>
                    )}
                  </tbody>
                  {filteredReports.length > 0 && (
                    <tfoot className="bg-slate-50 font-bold">
                      <tr>
                        <td colSpan={7} className="p-4 text-left">إجمالي تكاليف الإيجار:</td>
                        <td className="p-4 text-indigo-700 text-lg">
                          {filteredReports.reduce((sum, r) => sum + r.total_cost, 0).toFixed(2)} ريال
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && isAdmin && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-2xl font-bold mb-6 text-slate-800">إدارة المستخدمين</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold mb-4 text-slate-800">إضافة مستخدم جديد</h3>
                    <form onSubmit={handleAddUser} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">اسم المستخدم</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={userForm.username}
                          onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور</label>
                        <input 
                          type="password" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={userForm.password}
                          onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">الصلاحية</label>
                        <select 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={userForm.role}
                          onChange={e => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'supervisor' })}
                          required
                        >
                          <option value="supervisor">مشرف (إضافة فقط)</option>
                          <option value="admin">مدير (كامل الصلاحيات)</option>
                        </select>
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        <Plus size={18} /> إضافة مستخدم
                      </button>
                    </form>
                  </div>
                </div>
                
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-right">
                      <thead className="bg-slate-50">
                        <tr className="text-slate-500 text-sm">
                          <th className="p-4 font-medium">اسم المستخدم</th>
                          <th className="p-4 font-medium">الصلاحية</th>
                          <th className="p-4 font-medium">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.map(u => (
                          <tr key={u.id} className="text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-slate-800">{u.username}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                {u.role === 'admin' ? 'مدير' : 'مشرف'}
                              </span>
                            </td>
                            <td className="p-4">
                              {u.username !== 'admin' && (
                                <button onClick={() => handleDelete('users', u.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editingItem && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="text-lg font-bold text-slate-800">تعديل البيانات</h3>
                  <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleUpdate} className="p-6 space-y-4">
                  {editingItem.type === 'projects' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">اسم المشروع</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editingItem.data.name}
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">الموقع</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editingItem.data.location}
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, location: e.target.value } })}
                        />
                      </div>
                    </>
                  )}

                  {editingItem.type === 'jack-types' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">اسم النوع</label>
                        <input 
                          type="text" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editingItem.data.name}
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">سعر الإيجار اليومي</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editingItem.data.daily_rate}
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, daily_rate: parseFloat(e.target.value) } })}
                          required
                        />
                      </div>
                    </>
                  )}

                  {editingItem.type === 'transactions' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">المشروع</label>
                        <select 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editingItem.data.project_id}
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, project_id: parseInt(e.target.value) } })}
                          required
                        >
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">نوع الجاك</label>
                        <select 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editingItem.data.jack_type_id}
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, jack_type_id: parseInt(e.target.value) } })}
                          required
                        >
                          {jackTypes.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">الكمية</label>
                        <input 
                          type="number" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editingItem.data.quantity}
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, quantity: parseInt(e.target.value) } })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
                        <input 
                          type="date" 
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editingItem.data.date}
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, date: e.target.value } })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">نوع الحركة</label>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => setEditingItem({ ...editingItem, data: { ...editingItem.data, type: 'IN' } })}
                            className={`flex-1 py-2 rounded-lg font-bold transition-all ${editingItem.data.type === 'IN' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                          >
                            دخول
                          </button>
                          <button 
                            type="button"
                            onClick={() => setEditingItem({ ...editingItem, data: { ...editingItem.data, type: 'OUT' } })}
                            className={`flex-1 py-2 rounded-lg font-bold transition-all ${editingItem.data.type === 'OUT' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                          >
                            خروج
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                      حفظ التعديلات
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setEditingItem(null)}
                      className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
  >
    {icon}
    <span>{label}</span>
    {active && <ChevronRight size={16} className="mr-auto" />}
  </button>
);

const StatCard = ({ label, value, icon, color }: { label: string, value: number | string, icon: React.ReactNode, color: string }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`${color} p-4 rounded-xl`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

export default App;
