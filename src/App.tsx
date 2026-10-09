import {
  ArrowLeft,
  Bell,
  Box,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileImage,
  Home,
  Info,
  Luggage,
  MapPin,
  PackageCheck,
  Pencil,
  Pill,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { medicationCatalog, scenarios } from './data/mockCatalog';
import {
  addDays,
  enumerateDates,
  formatDate,
  formatFullDate,
  inclusiveDays,
  isMedicationActiveOnDate,
  overlapDays,
  requiredQuantity,
  toDateInput,
  tripDays,
} from './lib/date';
import { loadData, saveData } from './lib/storage';
import { mockPrescriptionOcrService, prescriptionOcrService } from './services/prescriptionOcr';
import type { AppData, DoseLog, Medication, OcrDraft, Trip } from './types';

type View = 'home' | 'create' | 'trip' | 'travel' | 'review';
type Overlay = 'manual' | 'ocr' | 'backup' | 'location' | 'finder' | 'edit-trip' | null;
type Filter = 'all' | 'scheduled' | 'backup';

const uid = () => crypto.randomUUID();
const today = () => toDateInput(new Date());

function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<View>('home');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [locationMedicationId, setLocationMedicationId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => saveData(data), [data]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedTrip = data.trips.find((trip) => trip.id === selectedTripId) ?? null;
  const editingTrip = data.trips.find((trip) => trip.id === editingTripId) ?? null;
  const tripMedications = selectedTrip
    ? data.medications.filter((medication) => medication.tripId === selectedTrip.id)
    : [];

  const updateData = (updater: (current: AppData) => AppData) => setData((current) => updater(current));

  const openTrip = (trip: Trip, target: View = 'trip') => {
    setSelectedTripId(trip.id);
    setView(target);
  };

  const navigateHome = () => {
    setView('home');
    setSelectedTripId(null);
    setEditingTripId(null);
    setOverlay(null);
  };

  const addTrip = (trip: Trip) => {
    updateData((current) => ({ ...current, trips: [trip, ...current.trips] }));
    openTrip(trip);
    setToast('旅行已创建，可以开始整理药品了');
  };

  const updateTrip = (tripId: string, patch: Pick<Trip, 'title' | 'destination' | 'startDate' | 'endDate'>) => {
    updateData((current) => ({
      ...current,
      trips: current.trips.map((trip) => trip.id === tripId ? { ...trip, ...patch } : trip),
    }));
    setOverlay(null);
    setEditingTripId(null);
    setToast('旅行计划已更新');
  };

  const addMedications = (medications: Medication[]) => {
    if (!selectedTrip || medications.length === 0) return;
    updateData((current) => ({
      ...current,
      medications: [...current.medications, ...medications],
      trips: current.trips.map((trip) =>
        trip.id === selectedTrip.id
          ? { ...trip, medicationIds: [...trip.medicationIds, ...medications.map((item) => item.id)] }
          : trip,
      ),
    }));
    setOverlay(null);
    setToast(medications.length === 1 ? '已加入旅行清单' : `已加入 ${medications.length} 项药品`);
  };

  const updateMedication = (id: string, patch: Partial<Medication>) => {
    updateData((current) => ({
      ...current,
      medications: current.medications.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const requestPacking = (medication: Medication) => {
    if (!medication.packed) updateMedication(medication.id, { packed: true });
    setLocationMedicationId(medication.id);
    setOverlay('location');
  };

  const removeMedication = (medication: Medication) => {
    updateData((current) => ({
      ...current,
      medications: current.medications.filter((item) => item.id !== medication.id),
      doseLogs: current.doseLogs.filter((log) => log.medicationId !== medication.id),
      trips: current.trips.map((trip) =>
        trip.id === medication.tripId
          ? { ...trip, medicationIds: trip.medicationIds.filter((id) => id !== medication.id) }
          : trip,
      ),
    }));
    setToast('已从本次旅行清单移除');
  };

  const enterTravel = () => {
    if (!selectedTrip) return;
    updateData((current) => ({
      ...current,
      trips: current.trips.map((trip) =>
        trip.id === selectedTrip.id ? { ...trip, status: 'active' } : trip,
      ),
    }));
    setView('travel');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="手机底部导航">
        <nav className="side-nav" aria-label="主要导航">
          <button className={view === 'home' || view === 'create' ? 'is-active' : ''} onClick={navigateHome}>
            <Home size={20} /> <span>首页</span>
          </button>
          <button className={view === 'create' ? 'is-active' : ''} onClick={() => setView('create')}>
            <Plus size={20} /> <span>新建</span>
          </button>
          {selectedTrip && (
            <>
              <button className={view === 'trip' ? 'is-active' : ''} onClick={() => setView('trip')}>
                <Luggage size={20} /> <span>准备</span>
              </button>
              <button className={view === 'travel' ? 'is-active' : ''} onClick={enterTravel}>
                <Bell size={20} /> <span>途中</span>
              </button>
              <button className={view === 'review' ? 'is-active' : ''} onClick={() => setView('review')}>
                <ClipboardCheck size={20} /> <span>回顾</span>
              </button>
            </>
          )}
        </nav>
      </aside>

      <main className="main-shell">
        <header className="mobile-header">
          <button className="mobile-app-brand" onClick={navigateHome} aria-label="返回旅行首页">
            <span><Pill size={18} /></span>
            <div><strong>旅药记</strong><small>{view === 'home' ? '旅行用药' : view === 'create' ? '创建旅行' : view === 'trip' ? '行前准备' : view === 'travel' ? '旅行模式' : '旅行回顾'}</small></div>
          </button>
        </header>

        {view === 'home' && (
          <HomePage
            trips={data.trips}
            medications={data.medications}
            onCreate={() => setView('create')}
            onOpen={openTrip}
            onEdit={(trip) => { setEditingTripId(trip.id); setOverlay('edit-trip'); }}
          />
        )}
        {view === 'create' && <CreateTripPage onCancel={navigateHome} onSubmit={addTrip} />}
        {view === 'trip' && selectedTrip && (
          <TripDetailPage
            trip={selectedTrip}
            medications={tripMedications}
            onBack={navigateHome}
            onOpenOverlay={setOverlay}
            onPack={requestPacking}
            onUnpack={(medication) => updateMedication(medication.id, { packed: false, storageLocation: undefined, storageNote: undefined })}
            onDelete={removeMedication}
            onEditTrip={() => { setEditingTripId(selectedTrip.id); setOverlay('edit-trip'); }}
            onTravel={enterTravel}
          />
        )}
        {view === 'travel' && selectedTrip && (
          <TravelModePage
            trip={selectedTrip}
            medications={tripMedications}
            doseLogs={data.doseLogs}
            onBack={() => setView('trip')}
            onConfirm={(log) => updateData((current) => ({ ...current, doseLogs: [...current.doseLogs, log] }))}
            onReminder={(message) => setToast(message)}
            onFind={() => setOverlay('finder')}
            onReview={() => setView('review')}
          />
        )}
        {view === 'review' && selectedTrip && (
          <ReviewPage
            trip={selectedTrip}
            medications={tripMedications}
            doseLogs={data.doseLogs}
            onBack={() => setView('trip')}
            onComplete={() => {
              updateData((current) => ({
                ...current,
                trips: current.trips.map((trip) => trip.id === selectedTrip.id ? { ...trip, status: 'completed' } : trip),
              }));
              setToast('旅行已归档，记录仍保存在本机浏览器');
            }}
          />
        )}

        <footer className="app-footer">
          数据仅保存在当前浏览器 · 药品信息不构成诊断或用药建议
        </footer>
      </main>

      {selectedTrip && overlay === 'manual' && (
        <Modal title="手动添加计划内用药" eyebrow="用户确认的既有计划" onClose={() => setOverlay(null)}>
          <ManualMedicationForm trip={selectedTrip} onSubmit={(item) => addMedications([item])} />
        </Modal>
      )}
      {selectedTrip && overlay === 'ocr' && (
        <Modal title="上传药单并创建草稿" eyebrow="本机 OCR · 结果需由用户核对" onClose={() => setOverlay(null)} wide>
          <OcrMedicationForm trip={selectedTrip} onSubmit={addMedications} />
        </Modal>
      )}
      {selectedTrip && overlay === 'backup' && (
        <Modal title="添加备用药" eyebrow="药品目录 · 非用药建议" onClose={() => setOverlay(null)} wide>
          <BackupMedicationForm trip={selectedTrip} onSubmit={addMedications} />
        </Modal>
      )}
      {selectedTrip && overlay === 'location' && locationMedicationId && (
        <Modal title="记录存放位置" eyebrow="标记已装入后，位置为必填项" onClose={() => setOverlay(null)}>
          <LocationForm
            medication={data.medications.find((item) => item.id === locationMedicationId)!}
            medications={tripMedications}
            onSubmit={(location, note) => {
              updateMedication(locationMedicationId, { packed: true, storageLocation: location, storageNote: note });
              setOverlay(null);
              setToast('存放位置已保存，药品准备完成');
            }}
          />
        </Modal>
      )}
      {selectedTrip && overlay === 'finder' && (
        <Modal title="查找药品位置" eyebrow="只查询已保存的位置" onClose={() => setOverlay(null)}>
          <LocationFinder medications={tripMedications} />
        </Modal>
      )}
      {editingTrip && overlay === 'edit-trip' && (
        <Modal title="修改旅行计划" eyebrow="更新名称、目的地与日期" onClose={() => { setOverlay(null); setEditingTripId(null); }}>
          <EditTripForm trip={editingTrip} onCancel={() => { setOverlay(null); setEditingTripId(null); }} onSubmit={(patch) => updateTrip(editingTrip.id, patch)} />
        </Modal>
      )}

      {toast && <div className="toast" role="status"><CheckCircle2 size={19} /> {toast}</div>}
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action, onBack }: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="page-header">
      <div className="page-header__title">
        {onBack && <button className="back-button" onClick={onBack}><ArrowLeft size={18} /> 返回</button>}
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </div>
  );
}

function HomePage({ trips, medications, onCreate, onOpen, onEdit }: {
  trips: Trip[];
  medications: Medication[];
  onCreate: () => void;
  onOpen: (trip: Trip, view?: View) => void;
  onEdit: (trip: Trip) => void;
}) {
  return (
    <div className="page page--home">
      <PageHeader
        eyebrow="我的旅行"
        title="旅行用药"
        description="从出发前备齐，到途中按计划确认，让每一种药都找得到、记得住。"
        action={<button className="primary-button" onClick={onCreate}><Plus size={18} /> 创建旅行</button>}
      />
      {trips.length === 0 ? (
        <section className="empty-hero">
          <div className="empty-hero__visual" aria-hidden="true">
            <div className="suitcase"><span /><Pill size={38} /></div>
            <span className="route-dot route-dot--one" />
            <span className="route-dot route-dot--two" />
            <MapPin className="route-pin" size={32} />
          </div>
          <div className="empty-hero__content">
            <span className="soft-badge"><Sparkles size={15} /> 从一次旅行开始</span>
            <h2>出发前，先把药品这件事安排好</h2>
            <p>创建行程，添加已有服药计划和自己决定携带的备用药；装好后记下位置，途中就能快速查找与确认。</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={onCreate}><Plus size={18} /> 创建第一趟旅行</button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="section-heading">
            <div><p className="eyebrow">行程总览</p><h2>继续你的旅行准备</h2></div>
          </section>
          <div className="trip-grid">
            {trips.map((trip) => {
              const items = medications.filter((item) => item.tripId === trip.id);
              const ready = items.filter((item) => item.packed && item.storageLocation).length;
              const progress = items.length ? Math.round((ready / items.length) * 100) : 0;
              const status = trip.status === 'completed' ? '已结束' : trip.status === 'active' ? '旅行中' : '准备中';
              return (
                <article className="trip-card" key={trip.id}>
                  <div className="trip-card__top">
                    <span className={`status-pill status-pill--${trip.status}`}>{status}</span>
                    <div className="trip-card__top-actions"><span className="trip-card__days">{tripDays(trip)} 天</span><button type="button" className="icon-button trip-card__edit" onClick={() => onEdit(trip)} aria-label={`修改 ${trip.title}`}><Pencil size={15} /></button></div>
                  </div>
                  <div className="trip-card__route">
                    <span className="trip-card__icon"><Luggage size={22} /></span>
                    <div><h3>{trip.title}</h3><p>{trip.destination || '未填写目的地'}</p></div>
                  </div>
                  <div className="date-strip">
                    <div><small>出发</small><strong>{formatDate(trip.startDate)}</strong></div>
                    <span className="date-strip__line" />
                    <div><small>返程</small><strong>{formatDate(trip.endDate)}</strong></div>
                  </div>
                  <div className="progress-row">
                    <div className="progress-label"><span>准备进度</span><strong>{ready}/{items.length} 已完成</strong></div>
                    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                  </div>
                  <button className="card-button" onClick={() => onOpen(trip, trip.status === 'completed' ? 'review' : trip.status === 'active' ? 'travel' : 'trip')}>
                    {trip.status === 'completed' ? '查看记录' : trip.status === 'active' ? '进入旅行模式' : '继续准备'} <ChevronRight size={17} />
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CreateTripPage({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (trip: Trip) => void }) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(addDays(today(), 2));
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!startDate || !endDate) return setError('请填写出发和返程日期');
    if (endDate < startDate) return setError('返程日期不能早于出发日期');
    onSubmit({
      id: uid(),
      title: title.trim() || (destination.trim() ? `${destination.trim()}之旅` : '我的旅行'),
      destination: destination.trim() || undefined,
      startDate,
      endDate,
      status: 'planning',
      medicationIds: [],
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="page page--narrow">
      <PageHeader eyebrow="新建行程" title="这次要去哪里？" description="日期会用于计算计划内药品的行程所需数量。" onBack={onCancel} />
      <form className="form-card" onSubmit={submit}>
        <div className="form-section-heading"><span><CalendarDays size={20} /></span><div><h2>旅行信息</h2><p>之后仍可在本地数据中保存这次行程。</p></div></div>
        <label className="field"><span>旅行名称 <em>选填</em></span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：杭州周末慢旅行" /></label>
        <label className="field"><span>目的地 <em>选填</em></span><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="城市或地区" /></label>
        <div className="field-row">
          <label className="field"><span>出发日期 <b>*</b></span><input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }} required /></label>
          <label className="field"><span>返程日期 <b>*</b></span><input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></label>
        </div>
        {startDate && endDate >= startDate && <div className="calculation-note"><CalendarDays size={17} /> 本次行程共 <strong>{inclusiveDays(startDate, endDate)} 天</strong>，包含出发与返程当天。</div>}
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>取消</button><button className="primary-button">保存并整理药品 <ChevronRight size={18} /></button></div>
      </form>
    </div>
  );
}

function EditTripForm({ trip, onCancel, onSubmit }: {
  trip: Trip;
  onCancel: () => void;
  onSubmit: (patch: Pick<Trip, 'title' | 'destination' | 'startDate' | 'endDate'>) => void;
}) {
  const [title, setTitle] = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination || '');
  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!startDate || !endDate) return setError('请填写出发和返程日期');
    if (endDate < startDate) return setError('返程日期不能早于出发日期');
    onSubmit({
      title: title.trim() || (destination.trim() ? `${destination.trim()}之旅` : '我的旅行'),
      destination: destination.trim() || undefined,
      startDate,
      endDate,
    });
  };

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="safety-note"><CalendarDays size={18} /><p>修改日期后，计划内药品的携带数量和旅行日程会按新日期重新计算；已添加药品、装药位置和服用记录都会保留。</p></div>
      <label className="field"><span>旅行名称</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：杭州周末慢旅行" autoFocus /></label>
      <label className="field"><span>目的地 <em>选填</em></span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="城市或地区" /></label>
      <div className="field-row">
        <label className="field"><span>出发日期 <b>*</b></span><input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (event.target.value > endDate) setEndDate(event.target.value); }} required /></label>
        <label className="field"><span>返程日期 <b>*</b></span><input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label>
      </div>
      {startDate && endDate >= startDate && <div className="calculation-note"><CalendarDays size={17} /> 修改后行程共 <strong>{inclusiveDays(startDate, endDate)} 天</strong>。</div>}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>取消</button><button className="primary-button"><Check size={18} /> 保存修改</button></div>
    </form>
  );
}

function TripDetailPage({ trip, medications, onBack, onOpenOverlay, onPack, onUnpack, onDelete, onEditTrip, onTravel }: {
  trip: Trip;
  medications: Medication[];
  onBack: () => void;
  onOpenOverlay: (overlay: Overlay) => void;
  onPack: (medication: Medication) => void;
  onUnpack: (medication: Medication) => void;
  onDelete: (medication: Medication) => void;
  onEditTrip: () => void;
  onTravel: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = medications.filter((item) => filter === 'all' || item.type === filter);
  const packed = medications.filter((item) => item.packed).length;
  const ready = medications.filter((item) => item.packed && item.storageLocation).length;
  const missing = medications.filter((item) => item.packed && !item.storageLocation).length;
  const progress = medications.length ? Math.round((ready / medications.length) * 100) : 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow={`${formatFullDate(trip.startDate)} — ${formatFullDate(trip.endDate)}`}
        title={trip.title}
        description={trip.destination ? `${trip.destination} · ${tripDays(trip)} 天行程` : `${tripDays(trip)} 天行程`}
        onBack={onBack}
        action={<div className="page-header__actions"><button className="secondary-button" onClick={onEditTrip}><Pencil size={17} /> 修改计划</button><button className="primary-button" onClick={onTravel}><Bell size={18} /> 进入旅行模式</button></div>}
      />
      <section className="progress-panel">
        <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><span><strong>{progress}%</strong><small>准备完成</small></span></div>
        <div className="progress-panel__copy"><p className="eyebrow">行前准备</p><h2>{medications.length === 0 ? '先添加这次要带的药品' : ready === medications.length ? '都准备好了，可以安心出发' : `还有 ${medications.length - ready} 项待完成`}</h2><p>只有装入并填写存放位置，才会计入准备完成。</p></div>
        <div className="stat-grid">
          <div><span>{medications.length}</span><small>已添加</small></div>
          <div><span>{medications.length - packed}</span><small>待装入</small></div>
          <div className={missing ? 'is-warning' : ''}><span>{missing}</span><small>待填位置</small></div>
        </div>
      </section>

      <section className="add-section">
        <div className="section-heading"><div><p className="eyebrow">添加药品</p><h2>准备带什么？</h2></div></div>
        <div className="add-grid">
          <button className="add-card" onClick={() => onOpenOverlay('manual')}><span className="add-card__icon add-card__icon--green"><Pill size={23} /></span><span><strong>手动添加计划</strong><small>按你已确认的用药安排填写</small></span><ChevronRight size={18} /></button>
          <button className="add-card" onClick={() => onOpenOverlay('ocr')}><span className="add-card__icon add-card__icon--blue"><FileImage size={23} /></span><span><strong>上传医院药单</strong><small>本机识别并生成可编辑草稿</small></span><span className="mock-chip">OCR</span><ChevronRight size={18} /></button>
          <button className="add-card" onClick={() => onOpenOverlay('backup')}><span className="add-card__icon add-card__icon--amber"><Box size={23} /></span><span><strong>添加备用药</strong><small>按场景浏览药品目录</small></span><ChevronRight size={18} /></button>
        </div>
      </section>

      <section className="medications-section">
        <div className="section-heading section-heading--tabs">
          <div><p className="eyebrow">携带清单</p><h2>药品与存放位置</h2></div>
          <div className="segmented-control">
            {([['all', '全部'], ['scheduled', '计划内'], ['backup', '备用药']] as const).map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={filter === key ? 'is-active' : ''}>{label}</button>)}
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="empty-list"><span><PackageCheck size={30} /></span><h3>{medications.length ? '这个分类还没有药品' : '携带清单还是空的'}</h3><p>从上方选择一种方式添加。计划内用药和备用药会清楚分开。</p></div>
        ) : (
          <div className="medication-list">
            {visible.map((medication) => (
              <MedicationCard key={medication.id} trip={trip} medication={medication} onPack={onPack} onUnpack={onUnpack} onDelete={onDelete} />
            ))}
          </div>
        )}
        {medications.length > 0 && <button className="find-location-button" onClick={() => onOpenOverlay('finder')}><Search size={18} /> 按药名查找存放位置</button>}
      </section>
    </div>
  );
}

function MedicationCard({ trip, medication, onPack, onUnpack, onDelete }: {
  trip: Trip;
  medication: Medication;
  onPack: (medication: Medication) => void;
  onUnpack: (medication: Medication) => void;
  onDelete: (medication: Medication) => void;
}) {
  const quantity = medication.type === 'scheduled' ? requiredQuantity(trip, medication) : medication.backupQuantity;
  const state = !medication.packed ? 'not_packed' : medication.storageLocation ? 'ready' : 'packed_location_missing';
  const sourceLabel = medication.source === 'manual' ? '手动添加' : medication.source === 'prescription_image' ? '药单草稿已确认' : '药品目录';
  return (
    <article className={`medication-card medication-card--${state}`}>
      <div className="medication-card__icon"><Pill size={22} /></div>
      <div className="medication-card__main">
        <div className="medication-card__heading">
          <div><div className="badge-row"><span className={medication.type === 'scheduled' ? 'type-badge' : 'type-badge type-badge--backup'}>{medication.type === 'scheduled' ? '计划内用药' : '备用药'}</span><span className="source-label">{sourceLabel}</span></div><h3>{medication.name}</h3></div>
          <div className={`readiness readiness--${state}`}>{state === 'ready' ? <CheckCircle2 size={16} /> : state === 'packed_location_missing' ? <MapPin size={16} /> : <Box size={16} />}{state === 'ready' ? '已准备完成' : state === 'packed_location_missing' ? '待填写位置' : '尚未装入'}</div>
        </div>
        <div className="medication-meta">
          {medication.schedule && <span><Clock3 size={16} /> 每日 {medication.schedule.dosesPerDay} 次 · {medication.schedule.times.join('、')} · 每次 {medication.schedule.unitsPerDose} {medication.schedule.unitLabel}</span>}
          {medication.scenario && <span><Sparkles size={16} /> {medication.scenario} · 场景候选</span>}
          <span><Luggage size={16} /> 携带数量：<strong>{quantity === null || quantity === undefined ? '数量待确认' : `${quantity} ${medication.type === 'scheduled' ? medication.schedule?.unitLabel : medication.backupUnit || '件'}`}</strong>{medication.type === 'scheduled' && medication.schedule ? <small>（{overlapDays(trip, medication)} 天 × {medication.schedule.dosesPerDay} 次 × {medication.schedule.unitsPerDose}）</small> : null}</span>
          {medication.storageLocation && <span className="location-line"><MapPin size={16} /> 存放：<strong>{medication.storageLocation}</strong>{medication.storageNote ? ` · ${medication.storageNote}` : ''}</span>}
        </div>
        {medication.notes && <p className="medication-note">{medication.notes}</p>}
        <div className="medication-actions">
          <button className={state === 'ready' ? 'secondary-button button-small' : 'primary-button button-small'} onClick={() => onPack(medication)}>{state === 'ready' ? <><MapPin size={16} /> 编辑位置</> : state === 'packed_location_missing' ? <><MapPin size={16} /> 补充位置</> : <><PackageCheck size={16} /> 已装入药盒</>}</button>
          {medication.packed && <button className="text-button text-button--muted" onClick={() => onUnpack(medication)}>撤销装入</button>}
          <button className="icon-button icon-button--danger" onClick={() => onDelete(medication)} title="从清单移除" aria-label={`移除 ${medication.name}`}><Trash2 size={17} /></button>
        </div>
      </div>
    </article>
  );
}

function Modal({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={21} /></button></header>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  );
}

function ManualMedicationForm({ trip, onSubmit }: { trip: Trip; onSubmit: (medication: Medication) => void }) {
  const [name, setName] = useState('');
  const [times, setTimes] = useState(['08:00']);
  const [units, setUnits] = useState('1');
  const [unitLabel, setUnitLabel] = useState('片');
  const [entireTrip, setEntireTrip] = useState(true);
  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const unitsPerDose = Number(units);
    if (!name.trim()) return setError('请填写药品名称');
    if (!times.length || times.some((time) => !time)) return setError('请确认每次服用时间');
    if (!Number.isFinite(unitsPerDose) || unitsPerDose <= 0 || !unitLabel.trim()) return setError('请填写有效的每次数量和单位');
    if (!entireTrip && (!startDate || !endDate || endDate < startDate)) return setError('请确认计划的开始与结束日期');
    onSubmit({
      id: uid(), tripId: trip.id, type: 'scheduled', name: name.trim(), packed: false,
      schedule: { dosesPerDay: times.length, times: [...times].sort(), unitsPerDose, unitLabel: unitLabel.trim(), startDate: entireTrip ? undefined : startDate, endDate: entireTrip ? undefined : endDate, notes: notes.trim() || undefined },
      source: 'manual', verificationStatus: 'confirmed', createdAt: new Date().toISOString(),
    });
  };

  const previewMedication = { schedule: { dosesPerDay: times.length, times, unitsPerDose: Number(units), unitLabel, startDate: entireTrip ? undefined : startDate, endDate: entireTrip ? undefined : endDate } } as Medication;
  const quantity = requiredQuantity(trip, previewMedication);

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="safety-note"><Info size={18} /><p>请完全按照你已经确认的医嘱或既有计划填写。这里不会判断药品、剂量或疗程是否合适。</p></div>
      <label className="field"><span>药品名称 <b>*</b></span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="填写药盒或药单上的名称" autoFocus /></label>
      <fieldset className="field"><legend>每日服用时间 <b>*</b></legend><div className="time-list">{times.map((time, index) => <div className="time-input" key={`${index}-${time}`}><Clock3 size={17} /><input type="time" value={time} onChange={(e) => setTimes((current) => current.map((item, i) => i === index ? e.target.value : item))} required />{times.length > 1 && <button type="button" className="icon-button" onClick={() => setTimes((current) => current.filter((_, i) => i !== index))} aria-label="删除时间"><X size={16} /></button>}</div>)}</div><button type="button" className="text-button" onClick={() => setTimes((current) => [...current, '12:00'])}><Plus size={16} /> 添加一个时间</button></fieldset>
      <div className="field-row field-row--dose"><label className="field"><span>每次数量 <b>*</b></span><input type="number" min="0.1" step="0.1" value={units} onChange={(e) => setUnits(e.target.value)} /></label><label className="field"><span>单位 <b>*</b></span><select value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)}><option>片</option><option>粒</option><option>袋</option><option>支</option><option>毫升</option><option>次</option></select></label></div>
      <fieldset className="field"><legend>计划有效期 <b>*</b></legend><label className="radio-card"><input type="radio" checked={entireTrip} onChange={() => setEntireTrip(true)} /><span><strong>本次旅行期间持续</strong><small>{formatFullDate(trip.startDate)} 至 {formatFullDate(trip.endDate)}</small></span></label><label className="radio-card"><input type="radio" checked={!entireTrip} onChange={() => setEntireTrip(false)} /><span><strong>自定义开始与结束日期</strong><small>只计算与旅行日期重叠的天数</small></span></label>{!entireTrip && <div className="field-row inset-fields"><label className="field"><span>开始日期</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label className="field"><span>结束日期</span><input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></div>}</fieldset>
      <label className="field"><span>备注 <em>选填</em></span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="例如：按既有计划随餐（仅记录你的原始信息）" rows={3} /></label>
      <div className="quantity-preview"><span><Luggage size={19} /></span><div><small>按当前信息计算</small><strong>本次应携带 {quantity === null ? '请确认计划信息' : `${quantity} ${unitLabel}`}</strong><p>每日 {times.length} 次 × 每次 {Number(units) || 0} {unitLabel} × {overlapDays(trip, previewMedication)} 天，不额外增加备用量。</p></div></div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><span className="save-note"><Check size={15} /> 保存后会生成旅行日程</span><button className="primary-button">确认加入计划 <ChevronRight size={18} /></button></div>
    </form>
  );
}

function OcrMedicationForm({ trip, onSubmit }: { trip: Trip; onSubmit: (medications: Medication[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [drafts, setDrafts] = useState<OcrDraft[]>([]);
  const [draftSource, setDraftSource] = useState<'local' | 'mock' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const chooseFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(nextFile.type)) return setError('请选择 JPG、PNG、GIF 或 WebP 图片');
    if (nextFile.size > 20 * 1024 * 1024) return setError('原图超过 20 MB，请裁剪或压缩后重试');
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setDrafts([]);
    setDraftSource(null);
    setError('');
  };

  const updateDraft = (index: number, patch: Partial<OcrDraft>) => {
    setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const createDrafts = async (source: 'local' | 'mock') => {
    if (!file) return setError('请先上传一张药单图片');
    setIsLoading(true);
    setError('');
    try {
      const nextDrafts = source === 'local'
        ? await prescriptionOcrService.createDrafts(file)
        : await mockPrescriptionOcrService.createDrafts(file);
      setDrafts(nextDrafts);
      setDraftSource(source);
    } catch (requestError) {
      setDrafts([]);
      setDraftSource(null);
      setError(requestError instanceof Error ? requestError.message : '识别失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file || drafts.length === 0) return;
    const namedDrafts = drafts.filter((draft) => draft.name.trim());
    if (namedDrafts.length === 0) return setError('没有可加入的药品名称，请重新识别或填写名称');
    const datesAreValid = Boolean(startDate && endDate && endDate >= startDate);
    const medications = namedDrafts.map((draft): Medication => {
      const units = Number(draft.unitsPerDose);
      const times = draft.times.filter(Boolean).sort();
      const hasCompleteSchedule = datesAreValid && times.length > 0 && Number.isFinite(units) && units > 0 && Boolean(draft.unitLabel.trim());
      const incompleteNote = hasCompleteSchedule ? '' : '识别结果未包含完整服用计划，因此未生成提醒。';
      return {
        id: uid(),
        tripId: trip.id,
        type: 'scheduled',
        name: draft.name.trim(),
        packed: false,
        schedule: hasCompleteSchedule ? { dosesPerDay: times.length, times, unitsPerDose: units, unitLabel: draft.unitLabel.trim(), startDate, endDate, notes: [draft.durationText, draft.notes].filter(Boolean).join('；') || undefined } : undefined,
        notes: [draft.durationText, draft.notes, incompleteNote].filter(Boolean).join('；') || undefined,
        source: 'prescription_image',
        sourceFileName: file.name,
        verificationStatus: 'confirmed',
        createdAt: new Date().toISOString(),
      };
    });
    onSubmit(medications);
  };

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="mock-banner mock-banner--live"><span className="mock-banner__icon"><Sparkles size={18} /></span><div><strong>本机药单识别</strong><p>图片只在当前设备处理，不会上传到服务器。首次识别可能需要稍等。</p></div><span className="mock-chip">本机 OCR</span></div>
      <div className="ocr-layout">
        <div>
          {!file ? (
            <label className="drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); chooseFile(e.dataTransfer.files[0]); }}><UploadCloud size={30} /><strong>上传医院药单图片</strong><span>点击选择，或将图片拖到这里</span><small>支持 JPG、PNG、GIF、WebP；大图会在本机自动压缩</small><input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(e) => chooseFile(e.target.files?.[0])} /></label>
          ) : (
            <div className="image-preview"><img src={preview} alt="用户上传的药单预览" /><div className="image-preview__footer"><span><FileImage size={16} /> {file.name}</span><button type="button" className="text-button" onClick={() => { setFile(null); setDrafts([]); setDraftSource(null); setPreview(''); }}>移除 / 重传</button></div></div>
          )}
          <button type="button" className="primary-button full-button" disabled={!file || isLoading} onClick={() => createDrafts('local')}>{isLoading ? <><span className="spinner" /> 正在识别药单…</> : <><Sparkles size={17} /> 识别药单全部药品</>}</button>
          <button type="button" className="text-button ocr-fallback" disabled={!file || isLoading} onClick={() => createDrafts('mock')}>不用识别，改用固定演示草稿</button>
        </div>
        <div className={`draft-panel ${drafts.length === 0 ? 'draft-panel--empty' : ''}`}>
          {drafts.length === 0 ? <div><ClipboardCheck size={30} /><h3>识别到的全部药品会显示在这里</h3><p>每种药单独显示；看不清的字段会留空，不会省略其他药品。</p></div> : <>
            <div className="draft-panel__header"><div><p className="eyebrow">{draftSource === 'local' ? '本机 OCR 识别结果' : '固定演示结果'}</p><h3>共识别 {drafts.length} 项，请逐项核对</h3></div><span className="review-badge">待用户确认</span></div>
            <div className="ocr-draft-list">{drafts.map((draft, draftIndex) => <article className="ocr-draft-card" key={draftIndex}>
              <div className="ocr-draft-card__header"><strong>第 {draftIndex + 1} 项</strong>{drafts.length > 1 && <button type="button" className="text-button text-button--muted" onClick={() => setDrafts((current) => current.filter((_, index) => index !== draftIndex))}><Trash2 size={14} /> 移除</button>}</div>
              {draft.warnings && draft.warnings.length > 0 && <div className="ocr-warnings">{draft.warnings.map((warning, warningIndex) => <p key={warningIndex}><Info size={14} /> {warning}</p>)}</div>}
              <label className="field field--review"><span>药品名称 <i>{confidenceLabel(draft.confidence.name)}</i></span><input value={draft.name} onChange={(e) => updateDraft(draftIndex, { name: e.target.value })} placeholder="请按图片填写" /></label>
              <div className="field-row field-row--dose"><label className="field field--review"><span>每次数量 <i>{confidenceLabel(draft.confidence.dosage)}</i></span><input type="number" min="0.1" step="0.1" value={draft.unitsPerDose} placeholder="可留空" onChange={(e) => updateDraft(draftIndex, { unitsPerDose: e.target.value ? Number(e.target.value) : '' })} /></label><label className="field field--review"><span>单位 <i>需核对</i></span><input value={draft.unitLabel} onChange={(e) => updateDraft(draftIndex, { unitLabel: e.target.value })} placeholder="例如：片" /></label></div>
              <div className="field field--review"><span>服用时间 <i>{confidenceLabel(draft.confidence.times)}</i></span><div className="time-list">{draft.times.map((time, timeIndex) => <div className="time-input" key={timeIndex}><Clock3 size={16} /><input type="time" value={time} onChange={(e) => updateDraft(draftIndex, { times: draft.times.map((item, index) => index === timeIndex ? e.target.value : item) })} /><button type="button" className="icon-button" onClick={() => updateDraft(draftIndex, { times: draft.times.filter((_, index) => index !== timeIndex) })}><X size={15} /></button></div>)}</div><button type="button" className="text-button" onClick={() => updateDraft(draftIndex, { times: [...draft.times, '12:00'] })}><Plus size={15} /> 添加时间</button></div>
              <label className="field field--review"><span>疗程 / 识别说明</span><input value={draft.durationText} onChange={(e) => updateDraft(draftIndex, { durationText: e.target.value })} placeholder="可留空" /></label>
              <label className="field"><span>备注</span><textarea rows={2} value={draft.notes} onChange={(e) => updateDraft(draftIndex, { notes: e.target.value })} /></label>
            </article>)}</div>
            <div className="ocr-shared-dates"><p className="eyebrow">全部药品的计划日期</p><div className="field-row"><label className="field field--review"><span>计划开始</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label className="field field--review"><span>计划结束</span><input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></div><small>缺少时间、数量或单位的药品仍会加入药单，但不会自动生成提醒。</small></div>
          </>}
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      {drafts.length > 0 && <div className="form-actions"><span className="save-note"><Info size={15} /> 将一次加入 {drafts.filter((draft) => draft.name.trim()).length} 项药品</span><button className="primary-button">我已核对，全部加入药单 <Check size={18} /></button></div>}
    </form>
  );
}

function confidenceLabel(value: 'high' | 'medium' | 'low') {
  return value === 'high' ? '较清晰 · 仍需核对' : value === 'medium' ? '需核对' : '低置信 / 缺失';
}

function BackupMedicationForm({ trip, onSubmit }: { trip: Trip; onSubmit: (medication: Medication[]) => void }) {
  const [scenario, setScenario] = useState('cold');
  const [selected, setSelected] = useState<string[]>([]);
  const [manualName, setManualName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('盒');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const candidates = medicationCatalog.filter((item) => item.scenario === scenario);
  const scenarioLabel = scenarios.find((item) => item.id === scenario)?.label || '其他';

  useEffect(() => setSelected([]), [scenario]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const catalogItems = medicationCatalog.filter((item) => selected.includes(item.id));
    if (catalogItems.length === 0 && !manualName.trim()) return setError('请选择至少一个候选项，或手动填写药品名称');
    const parsedQuantity = quantity ? Number(quantity) : undefined;
    if (quantity && (!Number.isFinite(parsedQuantity) || (parsedQuantity ?? 0) <= 0)) return setError('携带数量需为正数，也可以留空稍后确认');
    const base = { tripId: trip.id, type: 'backup' as const, backupQuantity: parsedQuantity, backupUnit: unit, packed: false, verificationStatus: 'confirmed' as const, createdAt: new Date().toISOString() };
    const items: Medication[] = catalogItems.map((item) => ({ ...base, id: uid(), name: item.name, scenario: scenarioLabel, notes: notes.trim() || '药品目录信息，请以实际包装说明书为准', source: 'scenario_catalog' }));
    if (manualName.trim()) items.push({ ...base, id: uid(), name: manualName.trim(), scenario: scenarioLabel, notes: notes.trim() || undefined, source: 'manual' });
    onSubmit(items);
  };

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="safety-note safety-note--amber"><Info size={18} /><p>场景只帮助浏览固定候选目录，不代表诊断或推荐。请只添加你自己已经决定携带的药品。</p></div>
      <div className="scenario-grid">{scenarios.map((item) => <button type="button" key={item.id} onClick={() => setScenario(item.id)} className={`scenario-card ${scenario === item.id ? 'is-active' : ''}`}><span>{item.icon}</span><strong>{item.label}</strong><small>{item.helper}</small>{scenario === item.id && <i><Check size={14} /></i>}</button>)}</div>
      {scenario !== 'other' && <div className="catalog-section"><div className="catalog-header"><div><p className="eyebrow">{scenarioLabel}</p><h3>选择要加入的候选项</h3></div><span className="mock-chip">药品目录 · 非用药建议</span></div><div className="catalog-grid">{candidates.map((item) => { const active = selected.includes(item.id); return <article className={`catalog-card ${active ? 'is-selected' : ''}`} key={item.id}><button type="button" className="catalog-card__select" aria-pressed={active} onClick={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}><div className="catalog-card__top"><span className="catalog-pill">场景候选</span><span className="check-box">{active && <Check size={15} />}</span></div><h4>{item.name}</h4><span className="catalog-manufacturer">{item.manufacturer}</span><span className="property-label">{item.property}</span><p>{item.summary}</p><small className="catalog-card__caution"><Info size={14} /> {item.caution}</small></button><a className="catalog-source" href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> {item.sourceLabel}</a></article>; })}</div></div>}
      <div className="manual-backup"><div><p className="eyebrow">知道药名？</p><h3>也可以手动添加</h3></div><label className="field"><span>药品名称 <em>选填</em></span><input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="填写你已决定携带的药品" /></label></div>
      <div className="field-row field-row--dose"><label className="field"><span>每项携带数量 <em>选填</em></span><input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="留空则显示待确认" /></label><label className="field"><span>单位</span><select value={unit} onChange={(e) => setUnit(e.target.value)}><option>盒</option><option>瓶</option><option>板</option><option>袋</option><option>支</option><option>件</option></select></label></div>
      <label className="field"><span>自己的备注 <em>选填</em></span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="只记录你的原始注意事项，不由系统生成" /></label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><span className="save-note">已选择 {selected.length + (manualName.trim() ? 1 : 0)} 项</span><button className="primary-button">确认加入备用药 <Check size={18} /></button></div>
    </form>
  );
}

const pillBoxLayouts = {
  first: {
    label: '第一层',
    helper: '6 个独立小格',
    slots: [
      { id: '1-A', label: 'A1', position: '左上格', location: '药盒第一层 · A1 左上格' },
      { id: '1-B', label: 'A2', position: '中上格', location: '药盒第一层 · A2 中上格' },
      { id: '1-C', label: 'A3', position: '右上格', location: '药盒第一层 · A3 右上格' },
      { id: '1-D', label: 'A4', position: '左下格', location: '药盒第一层 · A4 左下格' },
      { id: '1-E', label: 'A5', position: '中下格', location: '药盒第一层 · A5 中下格' },
      { id: '1-F', label: 'A6', position: '右下格', location: '药盒第一层 · A6 右下格' },
    ],
  },
  second: {
    label: '第二层',
    helper: '4 个大容量格',
    slots: [
      { id: '2-A', label: 'B1', position: '左上格', location: '药盒第二层 · B1 左上格' },
      { id: '2-B', label: 'B2', position: '右上格', location: '药盒第二层 · B2 右上格' },
      { id: '2-C', label: 'B3', position: '左下格', location: '药盒第二层 · B3 左下格' },
      { id: '2-D', label: 'B4', position: '右下格', location: '药盒第二层 · B4 右下格' },
    ],
  },
} as const;

type PillBoxLayer = keyof typeof pillBoxLayouts;

function LocationForm({ medication, medications, onSubmit }: { medication: Medication; medications: Medication[]; onSubmit: (location: string, note?: string) => void }) {
  const allSlots = [...pillBoxLayouts.first.slots, ...pillBoxLayouts.second.slots];
  const currentSlot = allSlots.find((slot) => slot.location === medication.storageLocation);
  const [layer, setLayer] = useState<PillBoxLayer>(currentSlot?.id.startsWith('2-') ? 'second' : 'first');
  const [choice, setChoice] = useState(currentSlot?.location || '');
  const [note, setNote] = useState(medication.storageNote || '');
  const [error, setError] = useState('');
  const occupiedByLocation = new Map(
    medications
      .filter((item) => item.id !== medication.id && item.packed && item.storageLocation)
      .map((item) => [item.storageLocation!, item]),
  );
  const layout = pillBoxLayouts[layer];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!choice) return setError('请先点击药盒中的一个空格位');
    if (occupiedByLocation.has(choice)) return setError('这个格位已经放有其他药品，请选择空格位');
    onSubmit(choice, note.trim() || undefined);
  };

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="packing-medication"><span><Pill size={19} /></span><div><small>正在装入</small><strong>{medication.name}</strong></div><span className={medication.type === 'scheduled' ? 'type-badge' : 'type-badge type-badge--backup'}>{medication.type === 'scheduled' ? '计划内' : '备用药'}</span></div>
      <fieldset className="field pillbox-field"><legend>选择药盒层数与格位 <b>*</b></legend>
        <div className="pillbox-layer-tabs" role="tablist" aria-label="药盒层数">
          {(Object.keys(pillBoxLayouts) as PillBoxLayer[]).map((key) => { const item = pillBoxLayouts[key]; const occupied = item.slots.filter((slot) => occupiedByLocation.has(slot.location)).length; return <button type="button" role="tab" aria-selected={layer === key} className={layer === key ? 'is-active' : ''} key={key} onClick={() => { setLayer(key); setError(''); }}><span>{item.label}</span><small>{item.helper} · {occupied} 个已占用</small></button>; })}
        </div>
        <div className="pillbox-stage">
          <div className="pillbox-orientation">盒盖方向</div>
          <div className={`pillbox-shell pillbox-shell--${layer}`}>
            <div className="pillbox-brand"><Pill size={14} /> 旅药记 SMART BOX</div>
            <div className={`pillbox-grid pillbox-grid--${layer}`}>{layout.slots.map((slot) => {
              const occupant = occupiedByLocation.get(slot.location);
              const selected = choice === slot.location;
              return <button type="button" key={slot.id} disabled={Boolean(occupant)} aria-pressed={selected} aria-label={occupant ? `${slot.label} ${slot.position}已被${occupant.name}占用` : `选择${slot.label} ${slot.position}`} className={`pillbox-slot ${selected ? 'is-selected' : ''} ${occupant ? 'is-occupied' : ''}`} onClick={() => { setChoice(slot.location); setError(''); }}>
                <span className="pillbox-slot__code">{slot.label}</span>
                {occupant ? <><span className="pillbox-slot__art"><Pill size={23} /><Pill size={18} /></span><strong>已占用</strong><small>{occupant.name}</small></> : selected ? <><span className="pillbox-slot__art pillbox-slot__art--selected"><Check size={23} /></span><strong>已选择</strong><small>{slot.position}</small></> : <><span className="pillbox-slot__empty"><Plus size={18} /></span><strong>{slot.position}</strong><small>点击放入</small></>}
              </button>;
            })}</div>
            <div className="pillbox-latch"><span /><span /></div>
          </div>
          <div className="pillbox-legend"><span><i className="is-empty" />可选择</span><span><i className="is-selected" />当前选择</span><span><i className="is-occupied" />已占用</span></div>
        </div>
      </fieldset>
      {choice && <div className="pillbox-selection"><MapPin size={17} /><div><small>当前选择</small><strong>{choice}</strong></div></div>}
      <label className="field"><span>位置备注 <em>选填</em></span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：透明小袋内、靠近拉链一侧" /></label>
      <div className="hardware-note"><span className="mock-chip">硬件状态 Mock</span><p>“已装入”由你手动确认，当前没有连接传感器或真实智能药盒。</p></div>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button full-button"><PackageCheck size={18} /> 保存位置并完成装药</button>
    </form>
  );
}

function LocationFinder({ medications }: { medications: Medication[] }) {
  const [query, setQuery] = useState('');
  const filtered = medications.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="location-finder">
      <label className="search-box"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入药品名称" autoFocus />{query && <button className="icon-button" onClick={() => setQuery('')}><X size={16} /></button>}</label>
      <div className="finder-results">{filtered.length === 0 ? <div className="empty-list empty-list--small"><Search size={24} /><h3>没有匹配的药品</h3><p>换一个名称试试。</p></div> : filtered.map((item) => <div className="finder-item" key={item.id}><span className="finder-item__icon"><Pill size={18} /></span><div><strong>{item.name}</strong><small>{item.type === 'scheduled' ? '计划内用药' : '备用药'}</small></div>{item.storageLocation ? <span className="finder-location"><MapPin size={16} /> {item.storageLocation}</span> : <span className="finder-missing">尚未记录位置</span>}</div>)}</div>
    </div>
  );
}

function TravelModePage({ trip, medications, doseLogs, onBack, onConfirm, onReminder, onFind, onReview }: {
  trip: Trip;
  medications: Medication[];
  doseLogs: DoseLog[];
  onBack: () => void;
  onConfirm: (log: DoseLog) => void;
  onReminder: (message: string) => void;
  onFind: () => void;
  onReview: () => void;
}) {
  const realToday = today();
  const initialDate = realToday < trip.startDate ? trip.startDate : realToday > trip.endDate ? trip.endDate : realToday;
  const [focusDate, setFocusDate] = useState(initialDate);
  const scheduled = medications.filter((item) => item.type === 'scheduled' && item.schedule && isMedicationActiveOnDate(item, trip, focusDate));
  const doses = scheduled.flatMap((medication) => medication.schedule!.times.map((time) => ({ medication, time, scheduledAt: `${focusDate}T${time}:00` }))).sort((a, b) => a.time.localeCompare(b.time));
  const backup = medications.filter((item) => item.type === 'backup');
  const confirmedCount = doses.filter((dose) => doseLogs.some((log) => log.medicationId === dose.medication.id && log.scheduledAt === dose.scheduledAt)).length;
  const canPrev = focusDate > trip.startDate;
  const canNext = focusDate < trip.endDate;

  return (
    <div className="page">
      <PageHeader eyebrow="旅行模式 · 手动开启" title={trip.title} description={`${formatFullDate(trip.startDate)} — ${formatFullDate(trip.endDate)}`} onBack={onBack} action={<button className="secondary-button" onClick={onFind}><Search size={17} /> 找药品</button>} />
      <div className="mock-banner mock-banner--compact"><span className="mock-banner__icon"><Bell size={18} /></span><div><strong>页面内提醒为 Mock</strong><p>不会请求系统通知权限，也未连接真实药盒。服用确认只代表你在页面上的记录。</p></div><button className="text-button" onClick={() => onReminder(doses.find((dose) => !doseLogs.some((log) => log.scheduledAt === dose.scheduledAt)) ? `模拟提醒：${doses.find((dose) => !doseLogs.some((log) => log.scheduledAt === dose.scheduledAt))!.time} 有一项计划待确认` : '今天的计划都已确认')}>演示一次提醒</button></div>
      <section className="travel-dashboard">
        <div className="travel-main">
          <div className="day-navigator"><button className="icon-button" disabled={!canPrev} onClick={() => setFocusDate(addDays(focusDate, -1))}><ChevronLeft size={20} /></button><div><small>{focusDate === realToday ? '今天' : '行程日期'}</small><strong>{formatDate(focusDate, true)}</strong></div><button className="icon-button" disabled={!canNext} onClick={() => setFocusDate(addDays(focusDate, 1))}><ChevronRight size={20} /></button></div>
          <div className="today-heading"><div><p className="eyebrow">计划内用药</p><h2>今日安排</h2></div><span>{confirmedCount}/{doses.length} 已确认</span></div>
          {doses.length === 0 ? <div className="empty-list"><Clock3 size={28} /><h3>这一天没有计划内用药</h3><p>备用药不会自动进入提醒。</p></div> : <div className="dose-timeline">{doses.map(({ medication, time, scheduledAt }) => { const log = doseLogs.find((item) => item.medicationId === medication.id && item.scheduledAt === scheduledAt); return <article className={`dose-card ${log ? 'dose-card--done' : ''}`} key={`${medication.id}-${time}`}><div className="dose-time"><Clock3 size={17} /><strong>{time}</strong></div><div className="dose-card__content"><div><h3>{medication.name}</h3><p>每次 {medication.schedule!.unitsPerDose} {medication.schedule!.unitLabel}{medication.storageLocation ? ` · ${medication.storageLocation}` : ' · 位置未记录'}</p></div>{log ? <span className="confirmed-state"><CheckCircle2 size={18} /> 已确认 <small>{new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(log.confirmedAt))} 记录</small></span> : <button className="primary-button button-small" onClick={() => onConfirm({ id: uid(), tripId: trip.id, medicationId: medication.id, scheduledAt, status: 'confirmed_taken', confirmedAt: new Date().toISOString() })}><Check size={17} /> 确认已服用</button>}</div></article>; })}</div>}
          <p className="neutral-note"><Info size={15} /> “未确认”仅表示没有页面记录，不推断你是否实际服用，也不提供补服或加量建议。</p>
        </div>
        <aside className="travel-side">
          <div className="travel-side__header"><div><p className="eyebrow">备用药</p><h2>携带清单</h2></div><button className="icon-button" onClick={onFind}><Search size={18} /></button></div>
          {backup.length === 0 ? <p className="muted-empty">没有添加备用药</p> : <div className="compact-med-list">{backup.map((item) => <div key={item.id}><span><Pill size={17} /></span><div><strong>{item.name}</strong><small>{item.backupQuantity ? `${item.backupQuantity} ${item.backupUnit}` : '数量待确认'}</small></div><span className={item.storageLocation ? 'compact-location' : 'compact-location is-missing'}>{item.storageLocation || '位置未记录'}</span></div>)}</div>}
          <button className="secondary-button full-button" onClick={onReview}><ClipboardCheck size={17} /> 查看旅行回顾</button>
        </aside>
      </section>
    </div>
  );
}

function ReviewPage({ trip, medications, doseLogs, onBack, onComplete }: {
  trip: Trip;
  medications: Medication[];
  doseLogs: DoseLog[];
  onBack: () => void;
  onComplete: () => void;
}) {
  const allDoses = useMemo(() => enumerateDates(trip.startDate, trip.endDate).flatMap((date) => medications.filter((item) => item.type === 'scheduled' && item.schedule && isMedicationActiveOnDate(item, trip, date)).flatMap((medication) => medication.schedule!.times.map((time) => ({ medication, date, time, scheduledAt: `${date}T${time}:00` })))), [trip, medications]);
  const confirmed = allDoses.filter((dose) => doseLogs.some((log) => log.medicationId === dose.medication.id && log.scheduledAt === dose.scheduledAt));
  const unconfirmed = allDoses.filter((dose) => !doseLogs.some((log) => log.medicationId === dose.medication.id && log.scheduledAt === dose.scheduledAt));
  const backup = medications.filter((item) => item.type === 'backup');
  return (
    <div className="page">
      <PageHeader eyebrow="中性记录 · 不作服药判断" title="旅行回顾" description={`${trip.title} · ${formatFullDate(trip.startDate)} — ${formatFullDate(trip.endDate)}`} onBack={onBack} action={trip.status !== 'completed' ? <button className="primary-button" onClick={onComplete}><ClipboardCheck size={18} /> 结束旅行并归档</button> : <span className="status-pill status-pill--completed">已结束</span>} />
      <section className="review-summary">
        <div><span className="review-summary__icon review-summary__icon--green"><CheckCircle2 size={24} /></span><div><small>已确认记录</small><strong>{confirmed.length}</strong><p>用户在页面中主动确认</p></div></div>
        <div><span className="review-summary__icon review-summary__icon--amber"><Clock3 size={24} /></span><div><small>未确认项目</small><strong>{unconfirmed.length}</strong><p>没有页面确认记录</p></div></div>
        <div><span className="review-summary__icon review-summary__icon--blue"><Box size={24} /></span><div><small>备用药携带</small><strong>{backup.length}</strong><p>不进入服用提醒</p></div></div>
      </section>
      <div className="review-grid">
        <section className="review-panel"><div className="review-panel__header"><div><p className="eyebrow">计划内用药</p><h2>服用确认记录</h2></div></div>{allDoses.length === 0 ? <div className="empty-list empty-list--small"><ClipboardCheck size={25} /><h3>没有计划记录</h3></div> : <div className="record-list">{allDoses.map((dose) => { const log = doseLogs.find((item) => item.medicationId === dose.medication.id && item.scheduledAt === dose.scheduledAt); return <div className="record-item" key={`${dose.medication.id}-${dose.scheduledAt}`}><div className="record-date"><strong>{formatDate(dose.date)}</strong><small>{dose.time}</small></div><div><strong>{dose.medication.name}</strong><small>{dose.medication.schedule!.unitsPerDose} {dose.medication.schedule!.unitLabel}</small></div>{log ? <span className="record-status record-status--confirmed"><Check size={15} /> 已确认</span> : <span className="record-status">未确认</span>}</div>; })}</div>}</section>
        <section className="review-panel"><div className="review-panel__header"><div><p className="eyebrow">备用药</p><h2>携带与位置</h2></div></div>{backup.length === 0 ? <div className="empty-list empty-list--small"><Box size={25} /><h3>没有备用药</h3></div> : <div className="record-list">{backup.map((item) => <div className="record-item record-item--backup" key={item.id}><span className="record-pill"><Pill size={17} /></span><div><strong>{item.name}</strong><small>{item.backupQuantity ? `${item.backupQuantity} ${item.backupUnit}` : '数量待确认'} · {item.scenario || '手动添加'}</small></div><span className={`record-location ${!item.storageLocation ? 'is-missing' : ''}`}><MapPin size={14} /> {item.storageLocation || '位置未记录'}</span></div>)}</div>}</section>
      </div>
      <div className="safety-note review-safety"><Info size={18} /><p>回顾仅汇总页面操作。“未确认”不等于漏服，“已确认”也不是医学记录验证；系统不会据此给出补服、加量或治疗建议。</p></div>
    </div>
  );
}

export default App;
