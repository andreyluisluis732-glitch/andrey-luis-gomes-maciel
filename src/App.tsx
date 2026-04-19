import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Save, 
  Trash2, 
  Search, 
  RefreshCcw, 
  Clock, 
  SortAsc,
  LayoutDashboard,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  ChevronRight,
  Info,
  Info as InfoIcon,
  GraduationCap,
  Users2,
  ArrowRight,
  Users,
  UserPlus,
  Mail,
  Phone,
  MoreVertical,
  CheckCircle2,
  Clock3,
  AlertCircle,
  X,
  Edit,
  History,
  Calculator,
  LogOut,
  LogIn,
  Plus,
  Contact as ContactIcon
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { NumericFormat } from 'react-number-format';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy
} from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { User } from 'firebase/auth';

// Error Handling Spec for Firestore Operations
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Not throwing anymore to avoid crashing the app on background sync errors
  // The UI should handle empty states instead.
}

interface SavedSimulation {
  id: string;
  name: string;
  clientId?: string;
  initialInvestment: number | string;
  monthlyContribution: number | string;
  interestRate: number | string;
  period: number | string;
  rateType: 'annual' | 'monthly';
  periodType: 'years' | 'months';
  date: string;
  timestamp: number;
}

interface Client {
  id: string;
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'lead' | 'proposta' | 'cliente' | 'perdido';
  investmentGoal: number;
  notes?: string;
  lastContact: string;
  createdAt: string;
}

interface ContactData {
  id: string;
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  category?: string;
  notes?: string;
  createdAt: string;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  public state: { hasError: boolean, error: any };
  public props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-200 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Ops! Algo deu errado.</h2>
            <p className="text-slate-500 mb-6 font-medium">
              Ocorreu um erro inesperado. Por favor, tente recarregar ou verifique os detalhes abaixo.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mb-4"
            >
              <RefreshCcw className="w-4 h-4" />
              Recarregar Página
            </button>
            <div className="text-left mt-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Detalhes do Erro</p>
              <pre className="p-4 bg-slate-900 text-pink-400 text-[10px] rounded-xl overflow-auto max-h-40 font-mono leading-relaxed">
                {error?.message || String(error) || 'Erro sem descrição'}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Helper for consistent calculations
const calculateSimulation = (
  initialInvestment: number | string, 
  monthlyContribution: number | string, 
  interestRate: number | string, 
  period: number | string, 
  rateType: 'annual' | 'monthly' = 'annual', 
  periodType: 'years' | 'months' = 'years'
) => {
  const data = [];
  const numInitialInvestment = Math.max(0, Number(initialInvestment) || 0);
  const numMonthlyContribution = Math.max(0, Number(monthlyContribution) || 0);
  const numInterestRate = Math.max(0, Number(interestRate) || 0);
  const numPeriod = Math.max(0, Number(period) || 0);

  const totalMonths = Math.min(600, periodType === 'years' ? numPeriod * 12 : numPeriod);
  const monthlyRate = rateType === 'annual' 
    ? Math.pow(1 + numInterestRate / 100, 1 / 12) - 1 
    : numInterestRate / 100;

  let currentAmount = numInitialInvestment;
  let totalInvested = numInitialInvestment;
  let totalInterest = 0;

  data.push({
    month: 0,
    year: 0,
    totalAmount: currentAmount,
    totalInvested: totalInvested,
    totalInterest: 0,
    interest: 0
  });

  if (isNaN(monthlyRate) || !isFinite(monthlyRate)) {
    return data;
  }

  for (let i = 1; i <= totalMonths; i++) {
    const interest = currentAmount * monthlyRate;
    currentAmount += interest;
    totalInterest += interest;

    currentAmount += numMonthlyContribution;
    totalInvested += numMonthlyContribution;

    data.push({
      month: i,
      year: Math.floor(i / 12),
      totalAmount: currentAmount,
      totalInvested: totalInvested,
      totalInterest: totalInterest,
      interest: interest
    });
  }

  return data;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'simulador' | 'crm' | 'contatos' | 'educacao' | 'sobre'>('dashboard');
  const [simulationName, setSimulationName] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [initialInvestment, setInitialInvestment] = useState<number | string>(1000);
  const [monthlyContribution, setMonthlyContribution] = useState<number | string>(100);
  const [interestRate, setInterestRate] = useState<number | string>(10);
  const [period, setPeriod] = useState<number | string>(10);
  const [rateType, setRateType] = useState<'annual' | 'monthly'>('annual');
  const [periodType, setPeriodType] = useState<'years' | 'months'>('years');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // CRM State
  const [clients, setClients] = useState<Client[]>([]);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [crmView, setCrmView] = useState<'table' | 'kanban'>('table');
  const [clientSortBy, setClientSortBy] = useState<'name' | 'status' | 'goal' | 'simulations' | 'contact'>('name');
  const [clientSortOrder, setClientSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);

  // Contacts State
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(null);
  const [contactSearch, setContactSearch] = useState('');

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Auth Listener
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      
      setUser(currentUser);
      setIsAuthLoading(false);
      
      if (currentUser) {
        try {
          // Create/Update user profile in Firestore
          const userRef = doc(db, 'users', currentUser.uid);
          const userData: any = {
            uid: currentUser.uid,
            email: currentUser.email
          };
          
          if (currentUser.displayName) userData.displayName = currentUser.displayName;
          if (currentUser.photoURL && (currentUser.photoURL.startsWith('http') || currentUser.photoURL.startsWith('https'))) {
            userData.photoURL = currentUser.photoURL;
          }

          // Use silent sync to avoid blocking the UI
          setDoc(userRef, userData, { merge: true }).catch(err => {
            console.warn('Profile sync warning (non-fatal):', err);
          });
        } catch (err) {
          console.warn('Profile sync logic error (non-fatal):', err);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Firestore Sync - Clients
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'clients'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'clients'));
    return () => unsubscribe();
  }, [user]);

  // Firestore Sync - Simulations
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'simulations'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const simulationsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as SavedSimulation));
      setSavedSimulations(simulationsData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'simulations'));
    return () => unsubscribe();
  }, [user]);

  // Firestore Sync - Contacts
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'contacts'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactData));
      setContacts(contactsData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'contacts'));
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('O login foi cancelado (janela fechada).');
      } else if (err.code === 'auth/popup-blocked') {
        setError('O pop-up de login foi bloqueado pelo seu navegador.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError(`O login com Google NÃO está ativado no Firebase para o projeto: ${firebaseConfig.projectId}. Verifique se você ativou o Google E selecionou um "E-mail de suporte" no console.`);
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`Este domínio (${window.location.hostname}) não está autorizado no Firebase. Vá no Console do Firebase > Autenticação > Configurações > Domínios Autorizados e adicione: ${window.location.hostname}`);
      } else {
        setError(`Falha ao entrar com Google: ${err.message || err.code || 'Erro desconhecido'}`);
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    
    setIsAuthSubmitting(true);
    try {
      if (authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccessMessage('Conta criada com sucesso!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccessMessage('Bem-vindo de volta!');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = 'Erro na autenticação.';
      if (err.code === 'auth/email-already-in-use') msg = 'Este e-mail já está em uso.';
      if (err.code === 'auth/invalid-credential') msg = 'E-mail ou senha incorretos.';
      if (err.code === 'auth/weak-password') msg = 'A senha deve ter pelo menos 6 caracteres.';
      if (err.code === 'auth/invalid-email') msg = 'E-mail inválido.';
      if (err.code === 'auth/operation-not-allowed') msg = `O método de login por e-mail não está ativado no projeto: ${firebaseConfig.projectId}`;
      if (err.code === 'auth/user-disabled') msg = 'Este usuário foi desativado.';
      
      setError(`${msg} (Código: ${err.code || 'unknown'})`);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setError('Erro ao sair. Tente novamente.');
    }
  };

  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const toggleClientSort = (field: typeof clientSortBy) => {
    if (clientSortBy === field) {
      setClientSortOrder(clientSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setClientSortBy(field);
      setClientSortOrder('asc');
    }
  };

  const getSortIcon = (field: typeof clientSortBy) => {
    if (clientSortBy !== field) return null;
    return clientSortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  const handleSaveSimulation = async () => {
    if (!user) return;
    if (!simulationName.trim()) {
      setError('Por favor, dê um nome para a sua simulação.');
      return;
    }

    const simulationId = Math.random().toString(36).substring(2, 9);
    const newSimulation: any = {
      id: simulationId,
      uid: user.uid,
      name: simulationName,
      clientId: selectedClientId || null,
      initialInvestment: Number(initialInvestment),
      monthlyContribution: Number(monthlyContribution),
      interestRate: Number(interestRate),
      period: Number(period),
      rateType,
      periodType,
      date: new Date().toLocaleDateString('pt-BR'),
      timestamp: Date.now(),
    };

    try {
      await setDoc(doc(db, 'simulations', simulationId), newSimulation);
      setSimulationName('');
      setSelectedClientId('');
      setSuccessMessage('Simulação salva com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `simulations/${simulationId}`);
    }
  };

  const loadSimulation = (sim: SavedSimulation) => {
    setInitialInvestment(sim.initialInvestment);
    setMonthlyContribution(sim.monthlyContribution);
    setInterestRate(sim.interestRate);
    setPeriod(sim.period);
    setRateType(sim.rateType);
    setPeriodType(sim.periodType);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSuccessMessage(`Cenário "${sim.name}" carregado!`);
  };

  const deleteSimulation = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'simulations', id));
      setSuccessMessage('Simulação removida.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `simulations/${id}`);
    }
  };

  const handleSaveClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const clientId = editingClient?.id || Math.random().toString(36).substring(2, 9);
    
    const clientData: any = {
      id: clientId,
      uid: user.uid,
      name: formData.get('name') as string,
      status: formData.get('status') as Client['status'],
      investmentGoal: Number(formData.get('goal')) || 0,
      lastContact: new Date().toLocaleDateString('pt-BR'),
      createdAt: editingClient?.createdAt || new Date().toLocaleDateString('pt-BR'),
    };

    const clientEmail = formData.get('email') as string;
    if (clientEmail) clientData.email = clientEmail;

    const clientPhone = formData.get('phone') as string;
    if (clientPhone) clientData.phone = clientPhone;

    const clientNotes = formData.get('notes') as string;
    if (clientNotes) clientData.notes = clientNotes;

    try {
      await setDoc(doc(db, 'clients', clientId), clientData);
      setSuccessMessage(editingClient ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
      setIsClientModalOpen(false);
      setEditingClient(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `clients/${clientId}`);
    }
  };

  const deleteClient = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'clients', id));
      setSuccessMessage('Cliente removido.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `clients/${id}`);
    }
  };

  const handleSaveContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const contactId = editingContact?.id || Math.random().toString(36).substring(2, 9);
    
    const contactData: any = {
      id: contactId,
      uid: user.uid,
      name: formData.get('name') as string,
      createdAt: editingContact?.createdAt || new Date().toLocaleDateString('pt-BR'),
    };

    const contactEmail = formData.get('email') as string;
    if (contactEmail) contactData.email = contactEmail;

    const contactPhone = formData.get('phone') as string;
    if (contactPhone) contactData.phone = contactPhone;

    const contactCategory = formData.get('category') as string;
    if (contactCategory) contactData.category = contactCategory;

    const contactNotes = formData.get('notes') as string;
    if (contactNotes) contactData.notes = contactNotes;

    try {
      await setDoc(doc(db, 'contacts', contactId), contactData);
      setSuccessMessage(editingContact ? 'Contato atualizado com sucesso!' : 'Contato cadastrado com sucesso!');
      setIsContactModalOpen(false);
      setEditingContact(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `contacts/${contactId}`);
    }
  };

  const deleteContact = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'contacts', id));
      setSuccessMessage('Contato removido.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `contacts/${id}`);
    }
  };

  const exportClientsToCSV = () => {
    const headers = ['Nome', 'Email', 'Telefone', 'Status', 'Meta de Investimento', 'Último Contato', 'Criado em'];
    const rows = clients.map(c => [
      c.name,
      c.email,
      c.phone,
      c.status,
      c.investmentGoal,
      c.lastContact,
      c.createdAt
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_crm_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessMessage('Planilha exportada com sucesso!');
  };

  const results = useMemo(() => {
    return calculateSimulation(
      Number(initialInvestment),
      Number(monthlyContribution),
      Number(interestRate),
      Number(period),
      rateType,
      periodType
    );
  }, [initialInvestment, monthlyContribution, interestRate, period, rateType, periodType]);

  const filteredAndSortedSimulations = useMemo(() => {
    return [...savedSimulations]
      .filter(sim => sim.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(sim => !selectedClientId || sim.clientId === selectedClientId)
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          return b.timestamp - a.timestamp;
        }
      });
  }, [savedSimulations, searchTerm, sortBy]);

  const finalResult = results[results.length - 1] || { totalAmount: 0, totalInvested: 0, totalInterest: 0 };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const pieData = useMemo(() => {
    const initial = Number(initialInvestment) || 0;
    const monthlyTotal = finalResult.totalInvested - initial;
    return [
      { name: 'Investimento Inicial', value: initial, color: '#6366f1' },
      { name: 'Total de Aportes', value: monthlyTotal, color: '#818cf8' },
      { name: 'Total em Juros', value: finalResult.totalInterest, color: '#10b981' },
    ];
  }, [initialInvestment, finalResult]);

  const dashboardStats = useMemo(() => {
    try {
      const totalAumSimulated = (savedSimulations || []).reduce((acc, sim) => {
        if (!sim) return acc;
        const simResults = calculateSimulation(
          sim.initialInvestment || 0,
          sim.monthlyContribution || 0,
          sim.interestRate || 0,
          sim.period || 0,
          sim.rateType || 'annual',
          sim.periodType || 'years'
        );
        const lastResult = simResults[simResults.length - 1];
        return acc + (lastResult?.totalAmount || 0);
      }, 0);

      const clientStatusCounts = (clients || []).reduce((acc, c) => {
        if (c && c.status) {
          acc[c.status] = (acc[c.status] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      return {
        totalAumSimulated,
        simulationCount: savedSimulations?.length || 0,
        clientCount: clients?.length || 0,
        leadCount: clientStatusCounts['lead'] || 0,
        opportunityCount: clientStatusCounts['proposta'] || 0,
        activeClients: clientStatusCounts['cliente'] || 0
      };
    } catch (err) {
      console.error('Error calculating dashboard stats:', err);
      return {
        totalAumSimulated: 0,
        simulationCount: 0,
        clientCount: 0,
        leadCount: 0,
        opportunityCount: 0,
        activeClients: 0
      };
    }
  }, [savedSimulations, clients]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-200"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">
              {authMode === 'signin' ? 'Bem-vindo!' : 'Crie sua conta'}
            </h2>
            <p className="text-slate-500">
              {authMode === 'signin' 
                ? 'Faça login para salvar suas simulações e gerenciar seus clientes.' 
                : 'Comece a gerenciar suas finanças e clientes hoje mesmo.'}
            </p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email" 
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Senha</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  required
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={isAuthSubmitting}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isAuthSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {authMode === 'signin' ? 'Entrar' : 'Cadastrar'}
                </>
              )}
            </button>
          </form>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs text-red-600 font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">ou continue com</span>
            </div>
          </div>

          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-3 mb-6"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Google
          </button>

          <p className="text-center text-sm text-slate-500">
            {authMode === 'signin' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button 
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="ml-2 text-indigo-600 font-bold hover:underline"
            >
              {authMode === 'signin' ? 'Cadastre-se' : 'Faça login'}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div key={user?.uid || 'anonymous'} className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              CapitalCalc
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-8 text-sm font-medium text-slate-500 sm:ml-8">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-indigo-50 ${activeTab === 'dashboard' ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'hover:text-indigo-600'}`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('simulador')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-indigo-50 ${activeTab === 'simulador' ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'hover:text-indigo-600'}`}
              >
                <Calculator className="w-4 h-4" />
                Simulador
              </button>
              <button 
                onClick={() => setActiveTab('crm')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-indigo-50 ${activeTab === 'crm' ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'hover:text-indigo-600'}`}
              >
                <Users className="w-4 h-4" />
                CRM
              </button>
              <button 
                onClick={() => setActiveTab('contatos')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-indigo-50 ${activeTab === 'contatos' ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'hover:text-indigo-600'}`}
              >
                <Users2 className="w-4 h-4" />
                Contatos
              </button>
              <button 
                onClick={() => setActiveTab('educacao')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-indigo-50 ${activeTab === 'educacao' ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'hover:text-indigo-600'}`}
              >
                <GraduationCap className="w-4 h-4" />
                Educação
              </button>
              <button 
                onClick={() => setActiveTab('sobre')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-indigo-50 ${activeTab === 'sobre' ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'hover:text-indigo-600'}`}
              >
                <Info className="w-4 h-4" />
                Sobre
              </button>
            </div>
            <div className="h-6 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-slate-800 leading-tight">{user.displayName}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{user.email}</p>
              </div>
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt={user.displayName || 'User'} 
                className="w-8 h-8 rounded-full border border-slate-200"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-4 py-2">
        <div className="flex items-center justify-around">
          {[
            { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
            { id: 'simulador', label: 'Simular', icon: Calculator },
            { id: 'crm', label: 'CRM', icon: Users },
            { id: 'educacao', label: 'Aprender', icon: Info },
            { id: 'sobre', label: 'Sobre', icon: ArrowRight },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'stroke-[2.5px]' : ''}`} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 sm:pb-8">
        <AnimatePresence>
          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 right-4 z-50 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2"
            >
              <TrendingUp className="w-5 h-5" />
              <span className="font-medium">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {getGreeting()}, {user?.displayName?.split(' ')[0] || 'Investidor'}!
                </h1>
                <p className="text-slate-500 mt-1">Aqui está o resumo das suas operações e metas.</p>
              </div>
              <button 
                onClick={() => setActiveTab('simulador')}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                Nova Simulação
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase tracking-tight">+12.5%</span>
                </div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Patrimônio Gerido</h3>
                <p className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
                  {formatCurrency(dashboardStats.totalAumSimulated)}
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{clients.length} Total</span>
                </div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Clientes Ativos</h3>
                <p className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{dashboardStats.activeClients}</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all">
                    <Clock3 className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2.5 py-1 rounded-lg uppercase tracking-tight">Pendente</span>
                </div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Leads em Proposta</h3>
                <p className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{dashboardStats.opportunityCount}</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-4 bg-indigo-100 text-indigo-700 rounded-2xl group-hover:bg-indigo-700 group-hover:text-white transition-all">
                    <Calculator className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cenários</span>
                </div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Simulado</h3>
                <p className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{dashboardStats.simulationCount}</p>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-slate-800">Crescimento Recente</h2>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> Juros
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-indigo-600">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" /> Aportes
                      </span>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={savedSimulations.slice(-5)}>
                        <defs>
                          <linearGradient id="colorAum" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="initialInvestment" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAum)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-bold text-slate-800">Últimas Simulações</h2>
                    <button 
                      onClick={() => setActiveTab('simulador')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      Ver todas <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {savedSimulations.slice(0, 4).map((sim) => (
                      <div key={sim.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer" onClick={() => { setActiveTab('simulador'); loadSimulation(sim); }}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                            <History className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{sim.name}</p>
                            <p className="text-xs text-slate-500">{sim.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-indigo-600">{formatCurrency(Number(sim.initialInvestment))}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest">{sim.period} {sim.periodType === 'years' ? 'anos' : 'meses'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h2 className="font-bold text-slate-800 mb-6">Status dos Clientes</h2>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                        <span>Leads</span>
                        <span>{Math.round((dashboardStats.leadCount / (clients.length || 1)) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${(dashboardStats.leadCount / (clients.length || 1)) * 100}%` }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                        <span>Propostas</span>
                        <span>{Math.round((dashboardStats.opportunityCount / (clients.length || 1)) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${(dashboardStats.opportunityCount / (clients.length || 1)) * 100}%` }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                        <span>Convertidos</span>
                        <span>{Math.round((dashboardStats.activeClients / (clients.length || 1)) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${(dashboardStats.activeClients / (clients.length || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                  <div className="relative z-10">
                    <TrendingUp className="w-8 h-8 mb-4 opacity-50" />
                    <h3 className="text-xl font-bold mb-2">Meta Financeira</h3>
                    <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
                      Continue simulando cenários para ajudar seus clientes a baterem suas metas de longo prazo.
                    </p>
                    <button 
                      onClick={() => setActiveTab('crm')}
                      className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all"
                    >
                      Acessar CRM
                    </button>
                  </div>
                  <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-indigo-500 rounded-full filter blur-3xl opacity-50" />
                </section>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'simulador' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar: Inputs & Management (Now First) */}
            <aside className="lg:col-span-4 space-y-6">
              {/* Simulation Identity */}
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                    Gestão Administrativa
                  </h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Nome do Cenário</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Aposentadoria"
                      value={simulationName}
                      onChange={(e) => setSimulationName(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Vincular a Cliente (Opcional)</label>
                    <select 
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                    >
                      <option value="">Nenhum cliente selecionado</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveSimulation}
                      className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-xl hover:bg-indigo-700 transition-all shadow-sm flex items-center justify-center gap-2 font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Salvar Simulação
                    </button>
                    <button 
                      onClick={() => setActiveTab('crm')}
                      className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                      title="Ver CRM"
                    >
                      <Users className="w-5 h-5" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {error && (
                      <motion.p 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[10px] text-red-500 font-medium"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <RefreshCcw className="w-4 h-4 text-indigo-600" />
                    Parâmetros
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Investimento Inicial</label>
                    <div className="relative group">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <NumericFormat 
                        value={initialInvestment}
                        onValueChange={(values) => setInitialInvestment(values.value)}
                        thousandSeparator="."
                        decimalSeparator=","
                        prefix="R$ "
                        allowNegative={false}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm group-hover:border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Aporte Mensal</label>
                    <div className="relative group">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <NumericFormat 
                        value={monthlyContribution}
                        onValueChange={(values) => setMonthlyContribution(values.value)}
                        thousandSeparator="."
                        decimalSeparator=","
                        prefix="R$ "
                        allowNegative={false}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm group-hover:border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-600">Taxa de Juros (%)</label>
                      <NumericFormat 
                        value={interestRate}
                        onValueChange={(values) => setInterestRate(values.value)}
                        decimalSeparator=","
                        allowNegative={false}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm hover:border-slate-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-600">Tipo de Taxa</label>
                      <select 
                        value={rateType}
                        onChange={(e) => setRateType(e.target.value as 'annual' | 'monthly')}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm appearance-none cursor-pointer hover:border-slate-300 text-sm"
                      >
                        <option value="annual">Anual</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-600">Período</label>
                      <NumericFormat 
                        value={period}
                        onValueChange={(values) => setPeriod(values.value)}
                        allowNegative={false}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm hover:border-slate-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-600">Unidade</label>
                      <select 
                        value={periodType}
                        onChange={(e) => setPeriodType(e.target.value as 'years' | 'months')}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm appearance-none cursor-pointer hover:border-slate-300 text-sm"
                      >
                        <option value="years">Anos</option>
                        <option value="months">Meses</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mt-6 shadow-inner ring-1 ring-inset ring-amber-500/5">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-tight">Metodologia Bancária</p>
                      <p className="text-[10px] text-amber-700 leading-relaxed mt-1">
                        Utilizamos a <strong>Taxa Equivalente Real</strong> para conversão anual/mensal e aportes <strong>Postecipados</strong> (ao final do mês). Este é o modelo exato usado por grandes bancos e corretoras.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Saved Simulations List */}
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Simulações Salvas</h2>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setSortBy('date')}
                      className={`p-1 rounded-md transition-all ${sortBy === 'date' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
                      title="Ordenar por Data"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setSortBy('name')}
                      className={`p-1 rounded-md transition-all ${sortBy === 'name' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
                      title="Ordenar por Nome"
                    >
                      <SortAsc className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {filteredAndSortedSimulations.length > 0 ? (
                      filteredAndSortedSimulations.map((sim) => (
                        <motion.div 
                          key={sim.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-700 text-sm truncate max-w-[120px]">{sim.name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => loadSimulation(sim)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Carregar"
                              >
                                <RefreshCcw className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => deleteSimulation(sim.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              {sim.date}
                            </span>
                            <span className="font-medium text-indigo-600/70">
                              {formatCurrency(Number(sim.initialInvestment))}
                            </span>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="py-8 text-center">
                        <p className="text-xs text-slate-400">Nenhuma simulação encontrada.</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </section>
            </aside>

            {/* Results & Charts */}
            <div className="lg:col-span-8 space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                  whileHover={{ y: -6, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    Patrimônio Final
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(finalResult.totalAmount)}</div>
                </motion.div>

                <motion.div 
                  whileHover={{ y: -6, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    Investimento Total
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(finalResult.totalInvested)}</div>
                </motion.div>

                <motion.div 
                  whileHover={{ y: -6, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    Rendimento (Juros)
                  </div>
                  <div className="text-3xl font-extrabold text-indigo-600 tracking-tight">{formatCurrency(finalResult.totalInterest)}</div>
                </motion.div>
              </div>

              {/* Main Chart */}
              <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold text-slate-800">Evolução do Patrimônio</h2>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-indigo-500" />
                      Total Acumulado
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-slate-200" />
                      Total Investido
                    </div>
                  </div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={results}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="month" 
                        stroke="#94a3b8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => val % 12 === 0 ? `${val/12}a` : ''}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => `R$ ${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="totalAmount" 
                        stroke="#6366f1" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorTotal)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="totalInvested" 
                        stroke="#e2e8f0" 
                        strokeWidth={2}
                        fill="transparent" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Composition Chart */}
                <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <h2 className="text-xl font-bold text-slate-800 mb-8">Composição Final</h2>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 mt-4">
                    {pieData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-500">{item.name}</span>
                        </div>
                        <span className="font-semibold text-slate-700">
                          {((item.value / finalResult.totalAmount) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Detailed Table */}
                <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <h2 className="text-xl font-bold text-slate-800 mb-6">Evolução Detalhada</h2>
                  <div className="flex-1 overflow-auto custom-scrollbar pr-2">
                    <table className="w-full text-sm text-left">
                      <thead className="text-slate-400 font-medium border-b border-slate-100">
                        <tr>
                          <th className="pb-3">Mês</th>
                          <th className="pb-3">Juros</th>
                          <th className="pb-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {results.filter((_, i) => i % (results.length > 24 ? 6 : 1) === 0 || i === results.length - 1).map((row, idx) => (
                          <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-3 text-slate-500">{row.month}</td>
                            <td className="py-3 text-emerald-600 font-medium">+{formatCurrency(row.interest)}</td>
                            <td className="py-3 text-right font-semibold text-slate-700">{formatCurrency(row.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'crm' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Gestão de Clientes</h2>
                <p className="text-slate-500 text-sm">Acompanhe seus leads e carteira de investimentos.</p>
              </div>
              <button 
                onClick={() => {
                  setEditingClient(null);
                  setIsClientModalOpen(true);
                }}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Novo Cliente
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Clientes', value: clients.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Leads Ativos', value: clients.filter(c => c.status === 'lead').length, icon: Clock3, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Em Negociação', value: clients.filter(c => c.status === 'proposta').length, icon: RefreshCcw, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Meta Total', value: formatCurrency(clients.reduce((acc, c) => acc + (c.investmentGoal || 0), 0)), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              ].map((stat, i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ y: -2 }}
                  className="bg-white p-5 rounded-3xl border border-slate-200 flex items-center gap-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} shrink-0`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{stat.label}</p>
                    <p className="text-xl font-bold text-slate-800 truncate" title={String(stat.value)}>{stat.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
                  <button 
                    onClick={() => setCrmView('table')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${crmView === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
                  >
                    Tabela
                  </button>
                  <button 
                    onClick={() => setCrmView('kanban')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${crmView === 'kanban' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
                  >
                    Kanban
                  </button>
                </div>
                <div className="flex items-center gap-4 flex-1 max-w-2xl">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar por nome, email ou telefone..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    />
                  </div>
                  <button 
                    onClick={exportClientsToCSV}
                    className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all"
                    title="Exportar para CSV"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {crmView === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleClientSort('name')}>
                          Cliente {getSortIcon('name')}
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleClientSort('status')}>
                          Status {getSortIcon('status')}
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleClientSort('goal')}>
                          Meta {getSortIcon('goal')}
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleClientSort('simulations')}>
                          Simulações {getSortIcon('simulations')}
                        </th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleClientSort('contact')}>
                          Último Contato {getSortIcon('contact')}
                        </th>
                        <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clients
                        .filter(c => 
                          (c.name?.toLowerCase() || '').includes(clientSearch.toLowerCase()) ||
                          (c.email?.toLowerCase() || '').includes(clientSearch.toLowerCase()) ||
                          (c.phone || '').includes(clientSearch)
                        )
                        .sort((a, b) => {
                          let comparison = 0;
                          const parseDate = (d: string) => {
                            if (!d) return 0;
                            const [day, month, year] = d.split('/').map(Number);
                            return new Date(year, month - 1, day).getTime();
                          };

                          switch (clientSortBy) {
                            case 'name':
                              comparison = a.name.localeCompare(b.name);
                              break;
                            case 'status':
                              const statusOrder = { lead: 0, proposta: 1, cliente: 2, perdido: 3 };
                              comparison = statusOrder[a.status] - statusOrder[b.status];
                              break;
                            case 'goal':
                              comparison = a.investmentGoal - b.investmentGoal;
                              break;
                            case 'simulations':
                              const countA = savedSimulations.filter(s => s.clientId === a.id).length;
                              const countB = savedSimulations.filter(s => s.clientId === b.id).length;
                              comparison = countA - countB;
                              break;
                            case 'contact':
                              comparison = parseDate(a.lastContact) - parseDate(b.lastContact);
                              break;
                          }
                          return clientSortOrder === 'asc' ? comparison : -comparison;
                        })
                        .map((client) => (
                        <tr key={client.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                {client.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{client.name}</p>
                                <p className="text-xs text-slate-400">{client.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              client.status === 'lead' ? 'bg-amber-100 text-amber-700' :
                              client.status === 'proposta' ? 'bg-indigo-100 text-indigo-700' :
                              client.status === 'cliente' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {client.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-700">{formatCurrency(client.investmentGoal)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1 text-slate-500">
                              <Calculator className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                {savedSimulations.filter(s => s.clientId === client.id).length}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {client.lastContact}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setEditingClient(client);
                                  setIsClientModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => deleteClient(client.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {clients.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                              <Users className="w-12 h-12 opacity-20" />
                              <p>Nenhum cliente cadastrado ainda.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 min-h-[500px]">
                  {(['lead', 'proposta', 'cliente', 'perdido'] as const).map((status) => (
                    <div key={status} className="flex flex-col gap-4">
                      <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            status === 'lead' ? 'bg-amber-400' :
                            status === 'proposta' ? 'bg-indigo-400' :
                            status === 'cliente' ? 'bg-emerald-400' :
                            'bg-slate-400'
                          }`} />
                          {status}
                        </h3>
                        <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-400 shadow-sm border border-slate-100">
                          {clients.filter(c => c.status === status).length}
                        </span>
                      </div>
                      <div className="flex-1 space-y-3">
                        {clients
                          .filter(c => c.status === status)
                          .filter(c => 
                            (c.name?.toLowerCase() || '').includes(clientSearch.toLowerCase()) ||
                            (c.email?.toLowerCase() || '').includes(clientSearch.toLowerCase()) ||
                            (c.phone || '').includes(clientSearch)
                          )
                          .sort((a, b) => {
                            let comparison = 0;
                            const parseDate = (d: string) => {
                              if (!d) return 0;
                              const [day, month, year] = d.split('/').map(Number);
                              return new Date(year, month - 1, day).getTime();
                            };

                            switch (clientSortBy) {
                              case 'name':
                                comparison = a.name.localeCompare(b.name);
                                break;
                              case 'goal':
                                comparison = a.investmentGoal - b.investmentGoal;
                                break;
                              case 'simulations':
                                const countA = savedSimulations.filter(s => s.clientId === a.id).length;
                                const countB = savedSimulations.filter(s => s.clientId === b.id).length;
                                comparison = countA - countB;
                                break;
                              case 'contact':
                                comparison = parseDate(a.lastContact) - parseDate(b.lastContact);
                                break;
                              default:
                                comparison = a.name.localeCompare(b.name);
                            }
                            return clientSortOrder === 'asc' ? comparison : -comparison;
                          })
                          .map((client) => (
                            <motion.div 
                              key={client.id}
                              layout
                              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 transition-all group cursor-pointer"
                              onClick={() => {
                                setEditingClient(client);
                                setIsClientModalOpen(true);
                              }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-800 truncate">{client.name}</span>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <Calculator className="w-3 h-3" />
                                  {savedSimulations.filter(s => s.clientId === client.id).length}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                  <Mail className="w-3 h-3" />
                                  <span className="truncate">{client.email}</span>
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                                  <span className="text-[10px] font-bold text-indigo-600">{formatCurrency(client.investmentGoal)}</span>
                                  <span className="text-[9px] text-slate-300">{client.lastContact}</span>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'contatos' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Agenda de Contatos</h2>
                <p className="text-slate-500">Gerencie seus contatos, parceiros e fornecedores.</p>
              </div>
              <button 
                onClick={() => {
                  setEditingContact(null);
                  setIsContactModalOpen(true);
                }}
                className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Novo Contato
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100">
                <div className="relative max-w-2xl">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar contatos..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Contato</th>
                      <th className="px-6 py-4">Categoria</th>
                      <th className="px-6 py-4">Telefone</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contacts
                      .filter(c => 
                        (c.name?.toLowerCase() || '').includes(contactSearch.toLowerCase()) ||
                        (c.email?.toLowerCase() || '').includes(contactSearch.toLowerCase()) ||
                        (c.category?.toLowerCase() || '').includes(contactSearch.toLowerCase())
                      )
                      .map((contact) => (
                      <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm uppercase">
                              {contact.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{contact.name}</p>
                              <p className="text-xs text-slate-400">{contact.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            {contact.category || 'Geral'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {contact.phone}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {contact.createdAt}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setEditingContact(contact);
                                setIsContactModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteContact(contact.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {contacts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2 text-slate-400">
                            <ContactIcon className="w-12 h-12 opacity-20" />
                            <p>Nenhum contato cadastrado ainda.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'educacao' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-3xl mx-auto space-y-8"
          >
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">Educação Financeira</h2>
              <div className="prose prose-slate max-w-none space-y-6">
                <div className="bg-indigo-50 p-6 rounded-2xl border-l-4 border-indigo-600">
                  <h3 className="text-lg font-bold text-indigo-900 mb-2">O que são Juros Compostos?</h3>
                  <p className="text-indigo-800 leading-relaxed">
                    Diferente dos juros simples, onde o rendimento é calculado apenas sobre o valor inicial, nos juros compostos o rendimento é calculado sobre o valor acumulado do período anterior. É o famoso "juros sobre juros".
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-2">O Fator Tempo</h4>
                    <p className="text-sm text-slate-600">Quanto mais tempo você deixa seu dinheiro investido, maior é o efeito da curva exponencial. O tempo é o seu maior aliado.</p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-2">Aportes Mensais</h4>
                    <p className="text-sm text-slate-600">Manter a constância nos investimentos acelera drasticamente o alcance dos seus objetivos financeiros.</p>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'sobre' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto text-center space-y-8"
          >
            <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200">
              <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Sobre o CapitalCalc</h2>
              <p className="text-slate-500 mt-4 leading-relaxed">
                Nossa missão é democratizar o planejamento financeiro através de ferramentas simples, poderosas e gratuitas. 
                Este simulador foi desenvolvido para ajudar você a visualizar o futuro do seu dinheiro.
              </p>
              <div className="bg-indigo-50 p-4 rounded-2xl mb-8 mt-6">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Versão 2.0</p>
                <p className="text-sm text-indigo-700">Novo Dashboard, CRM integrado e interface otimizada.</p>
              </div>
              <div className="pt-8 border-t border-slate-100 flex justify-center gap-8">
                <div>
                  <p className="text-2xl font-bold text-indigo-600">100%</p>
                  <p className="text-xs text-slate-400 uppercase font-bold">Gratuito</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-600">Privado</p>
                  <p className="text-xs text-slate-400 uppercase font-bold">Sem Cookies</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-600">Open</p>
                  <p className="text-xs text-slate-400 uppercase font-bold">Source</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Contact Modal */}
        <AnimatePresence>
          {isContactModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-xl font-bold text-slate-800">
                    {editingContact ? 'Editar Contato' : 'Novo Contato'}
                  </h3>
                  <button 
                    onClick={() => setIsContactModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveContact} className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Nome Completo</label>
                      <input 
                        name="name" 
                        type="text" 
                        required 
                        defaultValue={editingContact?.name}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Categoria</label>
                      <input 
                        name="category" 
                        type="text" 
                        placeholder="Ex: Parceiro, Fornecedor"
                        defaultValue={editingContact?.category}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                      <input 
                        name="email" 
                        type="email" 
                        defaultValue={editingContact?.email}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Telefone</label>
                      <input 
                        name="phone" 
                        type="text" 
                        defaultValue={editingContact?.phone}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Observações</label>
                    <textarea 
                      name="notes" 
                      rows={3}
                      defaultValue={editingContact?.notes}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsContactModalOpen(false)}
                      className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-semibold rounded-2xl hover:bg-slate-50 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      {editingContact ? 'Salvar Alterações' : 'Cadastrar Contato'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Client Modal */}
        <AnimatePresence>
          {isClientModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-xl font-bold text-slate-800">
                    {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                  </h3>
                  <button 
                    onClick={() => setIsClientModalOpen(false)}
                    className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
                <form onSubmit={handleSaveClient} className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Nome Completo</label>
                      <input 
                        name="name" 
                        required 
                        defaultValue={editingClient?.name}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Status</label>
                      <select 
                        name="status" 
                        defaultValue={editingClient?.status || 'lead'}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="lead">Lead</option>
                        <option value="proposta">Proposta</option>
                        <option value="cliente">Cliente</option>
                        <option value="perdido">Perdido</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                      <input 
                        name="email" 
                        type="email" 
                        placeholder="cliente@exemplo.com"
                        defaultValue={editingClient?.email}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Telefone</label>
                      <input 
                        name="phone" 
                        type="text"
                        placeholder="(00) 00000-0000"
                        defaultValue={editingClient?.phone}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Meta de Investimento (R$)</label>
                    <input 
                      name="goal" 
                      type="number" 
                      defaultValue={editingClient?.investmentGoal}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Observações</label>
                    <textarea 
                      name="notes" 
                      rows={3}
                      defaultValue={editingClient?.notes}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                  </div>

                  {editingClient && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Simulações Vinculadas</label>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                        {savedSimulations.filter(s => s.clientId === editingClient.id).length > 0 ? (
                          savedSimulations.filter(s => s.clientId === editingClient.id).map(sim => (
                            <div key={sim.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                <p className="text-xs font-bold text-slate-800">{sim.name}</p>
                                <p className="text-[10px] text-slate-400">{sim.date}</p>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  loadSimulation(sim);
                                  setIsClientModalOpen(false);
                                  setActiveTab('simulador');
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:underline"
                              >
                                Abrir
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Nenhuma simulação vinculada.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsClientModalOpen(false)}
                      className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-semibold rounded-2xl hover:bg-slate-50 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      <footer className="bg-white border-t border-slate-200 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-slate-400">
            © 2026 JurosCompostos.io - Planeje seu futuro financeiro hoje.
          </p>
          <div className="flex justify-center gap-6 mt-4 text-xs text-slate-400">
            <a href="#" className="hover:text-indigo-600">Termos</a>
            <a href="#" className="hover:text-indigo-600">Privacidade</a>
            <a href="#" className="hover:text-indigo-600">Contato</a>
          </div>
        </div>
      </footer>
      </div>
  );
}
