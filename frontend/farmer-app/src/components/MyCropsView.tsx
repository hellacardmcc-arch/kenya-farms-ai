import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { getFarmerDashboard, addCrop, deleteCrop, updateCropExpectedYield, getYieldRecords, addYieldRecord, createFarm, type Crop, type Farm, type YieldRecord } from '../api/farmerApi';
import LanguageSelector from './LanguageSelector';
import './MyCropsView.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SWAHILI_NAMES: Record<string, string> = { Maize: 'Mahindi', Tomatoes: 'Nyanya', Kale: 'Sukuma Wiki', Beans: 'Maharage' };

const MyCropsView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<'sw' | 'en'>('sw');
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddFarm, setShowAddFarm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingFarm, setAddingFarm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const [yields, setYields] = useState<YieldRecord[]>([]);
  const [showRecordYield, setShowRecordYield] = useState<string | null>(null);
  const [editingExpected, setEditingExpected] = useState<string | null>(null);
  const [expectedYieldVal, setExpectedYieldVal] = useState<string>('');

  const [farmForm, setFarmForm] = useState({ name: '', location: '', area_hectares: 0.5 });
  const [form, setForm] = useState({
    farm_id: '',
    name: '',
    swahili_name: '',
    planted_date: new Date().toISOString().slice(0, 10),
    harvest_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    area_hectares: 0.5,
    expected_yield_kg: 0,
  });
  const [yieldForm, setYieldForm] = useState({
    crop_id: '',
    farm_id: '',
    season_year: new Date().getFullYear(),
    season_label: '',
    harvest_date: new Date().toISOString().slice(0, 10),
    actual_yield_kg: 0,
    unit: 'kg',
  });

  const load = () => {
    if (!token) return;
    Promise.all([getFarmerDashboard(token), getYieldRecords(token)])
      .then(([d, y]) => {
        setCrops(d.crops || []);
        setFarms(d.farms || []);
        setYields(y || []);
      })
      .catch(() => { setCrops([]); setFarms([]); setYields([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleAddFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !farmForm.name.trim()) {
      alert(language === 'sw' ? 'Ingiza jina la shamba' : 'Enter farm name');
      return;
    }
    setAddingFarm(true);
    try {
      await createFarm(token, {
        name: farmForm.name.trim(),
        location: farmForm.location.trim() || undefined,
        area_hectares: farmForm.area_hectares || undefined,
      });
      setFarmForm({ name: '', location: '', area_hectares: 0.5 });
      setShowAddFarm(false);
      load();
      alert(language === 'sw' ? 'Shamba limeongezwa!' : 'Farm added!');
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      const msg = apiErr || (language === 'sw' ? 'Imeshindwa kuhifadhi shamba' : 'Failed to save land');
      alert(msg);
    } finally {
      setAddingFarm(false);
    }
  };

  const handleAddCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.farm_id || !form.name.trim()) {
      alert(language === 'sw' ? 'Chagua shamba na jina la mazao' : 'Select farm and crop name');
      return;
    }
    setAdding(true);
    try {
      await addCrop(token, {
        farm_id: form.farm_id,
        name: form.name.trim(),
        swahili_name: form.swahili_name.trim() || undefined,
        planted_date: form.planted_date || undefined,
        harvest_date: form.harvest_date || undefined,
        area_hectares: form.area_hectares || undefined,
        expected_yield_kg: form.expected_yield_kg || undefined,
      });
      setForm({ ...form, name: '', swahili_name: '' });
      setShowAddForm(false);
      load();
      alert(language === 'sw' ? 'Mazao yameongezwa!' : 'Crop added!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || (language === 'sw' ? 'Imeshindwa' : 'Failed');
      alert(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleSaveExpectedYield = async (cropId: string) => {
    if (!token) return;
    const val = parseFloat(expectedYieldVal);
    if (isNaN(val) || val < 0) {
      alert(language === 'sw' ? 'Ingiza nambari halali' : 'Enter a valid number');
      return;
    }
    try {
      await updateCropExpectedYield(token, cropId, val);
      setEditingExpected(null);
      setExpectedYieldVal('');
      load();
      alert(language === 'sw' ? 'Imesahihishwa!' : 'Updated!');
    } catch {
      alert(language === 'sw' ? 'Imeshindwa' : 'Failed');
    }
  };

  const handleRecordYield = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !yieldForm.crop_id || !yieldForm.farm_id || yieldForm.actual_yield_kg <= 0) {
      alert(language === 'sw' ? 'Jaza sehemu zote' : 'Fill all fields');
      return;
    }
    try {
      await addYieldRecord(token, {
        crop_id: yieldForm.crop_id,
        farm_id: yieldForm.farm_id,
        season_year: yieldForm.season_year,
        season_label: yieldForm.season_label || undefined,
        harvest_date: yieldForm.harvest_date || undefined,
        actual_yield_kg: yieldForm.actual_yield_kg,
        unit: yieldForm.unit,
      });
      setShowRecordYield(null);
      setYieldForm({ ...yieldForm, crop_id: '', farm_id: '', actual_yield_kg: 0 });
      load();
      alert(language === 'sw' ? 'Mavuno yameandikwa!' : 'Yield recorded!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || (language === 'sw' ? 'Imeshindwa' : 'Failed');
      alert(msg);
    }
  };

  const handleRemoveCrop = async (cropId: string) => {
    if (!token) return;
    if (!confirm(language === 'sw' ? 'Una uhakika unataka kufuta mazao haya?' : 'Are you sure you want to remove this crop?')) return;
    setDeleting(cropId);
    try {
      await deleteCrop(token, cropId);
      load();
      alert(language === 'sw' ? 'Mazao yamefutwa' : 'Crop removed');
    } catch {
      alert(language === 'sw' ? 'Imeshindwa' : 'Failed');
    } finally {
      setDeleting(null);
    }
  };

  const t = {
    en: {
      title: 'My Crops',
      subtitle: 'Add, remove, and view reports from planting to harvest',
      addCrop: 'Add Crop',
      remove: 'Remove',
      viewReport: 'View Report',
      planted: 'Planted',
      harvest: 'Harvest',
      area: 'Area',
      status: 'Status',
      daysLeft: 'days left',
      progress: 'Progress',
      report: 'Crop Report',
      back: 'Back',
      home: 'Home',
      selectFarm: 'Select farm',
      cropName: 'Crop name',
      swahiliName: 'Swahili name (optional)',
      cancel: 'Cancel',
      noCrops: 'No crops yet. Add your first crop!',
      noFarms: 'Add a farm first to add crops.',
      addFarm: 'Add Farm',
      farmName: 'Farm name',
      farmLocation: 'Location (optional)',
      expectedYield: 'Expected yield (kg)',
      currentYield: 'Current yield',
      pastYields: 'Past yields',
      recordYield: 'Record yield',
      perFarm: 'per farm',
      season: 'Season',
      yieldByFarm: 'Yield by farm & season',
      yieldChart: 'Past yield per crop per season',
    },
    sw: {
      title: 'Mazao Yangu',
      subtitle: 'Ongeza, futa, na angalia ripoti kutoka kupanda hadi kuvuna',
      addCrop: 'Ongeza Mazao',
      remove: 'Futa',
      viewReport: 'Angalia Ripoti',
      planted: 'Ilipandwa',
      harvest: 'Kuvuna',
      area: 'Eneo',
      status: 'Hali',
      daysLeft: 'siku zimesalia',
      progress: 'Maendeleo',
      report: 'Ripoti ya Mazao',
      back: 'Rudi',
      home: 'Nyumbani',
      selectFarm: 'Chagua shamba',
      cropName: 'Jina la mazao',
      swahiliName: 'Jina la Kiswahili (si lazima)',
      cancel: 'Ghairi',
      noCrops: 'Hakuna mazao bado. Ongeza mazao yako ya kwanza!',
      noFarms: 'Ongeza shamba kwanza ili kuongeza mazao.',
      addFarm: 'Ongeza Shamba',
      farmName: 'Jina la shamba',
      farmLocation: 'Mahali (si lazima)',
      expectedYield: 'Matumaini ya mavuno (kg)',
      currentYield: 'Mavuno ya sasa',
      pastYields: 'Mavuno ya zamani',
      recordYield: 'Andika mavuno',
      perFarm: 'kwa shamba',
      season: 'Msimu',
      yieldByFarm: 'Mavuno kwa shamba na msimu',
      yieldChart: 'Mavuno ya zamani kwa mazao kwa msimu',
    },
  };

  const yieldChartData = React.useMemo(() => {
    if (yields.length === 0) return null;
    const seasons = [...new Set(yields.map((y) => y.season_year))].sort((a, b) => a - b);
    const cropNames = [...new Set(yields.map((y) => language === 'sw' ? (y.crop_swahili_name || y.crop_name) : y.crop_name))];
    const colors = ['#166534', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6'];
    const datasets = cropNames.map((name, i) => ({
      label: name,
      data: seasons.map((s) => {
        const recs = yields.filter((y) => y.season_year === s && (language === 'sw' ? (y.crop_swahili_name || y.crop_name) : y.crop_name) === name);
        return recs.reduce((sum, r) => sum + r.actual_yield_kg, 0);
      }),
      backgroundColor: colors[i % colors.length],
    }));
    return {
      labels: seasons.map((s) => String(s)),
      datasets,
    };
  }, [yields, language]);

  const yieldsByFarmSeason = yields.reduce<Record<string, YieldRecord[]>>((acc, y) => {
    const key = `${y.farm_id}|${y.season_year}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(y);
    return acc;
  }, {});

  const currentLang = t[language];

  const getCropReport = (c: Crop) => {
    const planted = c.planted_date ? new Date(c.planted_date) : new Date();
    const harvest = c.harvest_date ? new Date(c.harvest_date) : new Date(planted.getTime() + 90 * 86400000);
    const totalDays = Math.max(1, Math.ceil((harvest.getTime() - planted.getTime()) / 86400000));
    const elapsed = Math.max(0, Math.ceil((Date.now() - planted.getTime()) / 86400000));
    const daysLeft = Math.max(0, Math.ceil((harvest.getTime() - Date.now()) / 86400000));
    const progressPct = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
    return { planted, harvest, totalDays, elapsed, daysLeft, progressPct };
  };

  return (
    <div className="my-crops-view farmer-dashboard">
      <header className="kenya-flag-header">
        <div>
          <h1>Kenya Farms AI</h1>
          <p style={{ fontSize: '14px', opacity: 0.9 }}>{currentLang.title}</p>
        </div>
        <div className="header-actions">
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
          <button onClick={() => { logout(); navigate('/login'); }} className="header-btn">
            {language === 'sw' ? 'Toka' : 'Logout'}
          </button>
        </div>
      </header>

      <div className="my-crops-content">
        <button onClick={() => navigate('/')} className="back-btn">
          ← {currentLang.back}
        </button>
        <h2 className="my-crops-title">{currentLang.subtitle}</h2>

        <button
          type="button"
          className={`add-crop-toggle ${(showAddForm || showAddFarm) ? 'expanded' : ''}`}
          onClick={() => {
            if (farms.length === 0) {
              setShowAddFarm(!showAddFarm);
              setShowAddForm(false);
            } else {
              setShowAddForm(!showAddForm);
              setShowAddFarm(false);
            }
          }}
        >
          <span>➕ {farms.length === 0 ? currentLang.addFarm : currentLang.addCrop}</span>
          <span className="toggle-icon">{(showAddForm || showAddFarm) ? '▼' : '▶'}</span>
        </button>

        {farms.length === 0 && (
          <div className="add-farm-section">
            <p className="no-farms-msg">{currentLang.noFarms}</p>
            <button type="button" className="add-farm-btn" onClick={() => setShowAddFarm(!showAddFarm)}>
              {showAddFarm ? '▼' : '▶'} {currentLang.addFarm}
            </button>
            {showAddFarm && (
              <form className="add-farm-form" onSubmit={handleAddFarm}>
                <div className="form-row">
                  <label htmlFor="farm-name">{currentLang.farmName}</label>
                  <input id="farm-name" type="text" value={farmForm.name} onChange={(e) => setFarmForm({ ...farmForm, name: e.target.value })} required placeholder={currentLang.farmName} />
                </div>
                <div className="form-row">
                  <label htmlFor="farm-location">{currentLang.farmLocation}</label>
                  <input id="farm-location" type="text" value={farmForm.location} onChange={(e) => setFarmForm({ ...farmForm, location: e.target.value })} placeholder={currentLang.farmLocation} />
                </div>
                <div className="form-row">
                  <label htmlFor="farm-area">{currentLang.area} (ha)</label>
                  <input id="farm-area" type="number" step="0.1" min="0.1" value={farmForm.area_hectares} onChange={(e) => setFarmForm({ ...farmForm, area_hectares: parseFloat(e.target.value) || 0.5 })} />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowAddFarm(false)}>{currentLang.cancel}</button>
                  <button type="submit" disabled={addingFarm}>{addingFarm ? '...' : currentLang.addFarm}</button>
                </div>
              </form>
            )}
          </div>
        )}

        {showAddForm && (
          <form className="add-crop-form" onSubmit={handleAddCrop}>
            <div className="form-row">
              <label htmlFor="farm-select">{currentLang.selectFarm}</label>
              <select
                id="farm-select"
                value={form.farm_id}
                onChange={(e) => setForm({ ...form, farm_id: e.target.value })}
                required
                aria-label={currentLang.selectFarm}
              >
                <option value="">{currentLang.selectFarm}</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name || f.id}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="crop-name">{currentLang.cropName}</label>
              <input
                id="crop-name"
                type="text"
                placeholder={currentLang.cropName}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                aria-label={currentLang.cropName}
              />
            </div>
            <div className="form-row">
              <label htmlFor="swahili-name">{currentLang.swahiliName}</label>
              <input
                id="swahili-name"
                type="text"
                placeholder={currentLang.swahiliName}
                value={form.swahili_name}
                onChange={(e) => setForm({ ...form, swahili_name: e.target.value })}
                aria-label={currentLang.swahiliName}
              />
            </div>
            <div className="form-row">
              <label htmlFor="planted-date">{currentLang.planted}</label>
              <input
                id="planted-date"
                type="date"
                value={form.planted_date}
                onChange={(e) => setForm({ ...form, planted_date: e.target.value })}
                aria-label={currentLang.planted}
              />
            </div>
            <div className="form-row">
              <label htmlFor="harvest-date">{currentLang.harvest}</label>
              <input
                id="harvest-date"
                type="date"
                value={form.harvest_date}
                onChange={(e) => setForm({ ...form, harvest_date: e.target.value })}
                aria-label={currentLang.harvest}
              />
            </div>
            <div className="form-row">
              <label htmlFor="area-hectares">{currentLang.area} (ha)</label>
              <input
                id="area-hectares"
                type="number"
                step="0.1"
                min="0.1"
                value={form.area_hectares}
                onChange={(e) => setForm({ ...form, area_hectares: parseFloat(e.target.value) || 0.5 })}
                aria-label={currentLang.area}
              />
            </div>
            <div className="form-row">
              <label htmlFor="expected-yield">{currentLang.expectedYield}</label>
              <input
                id="expected-yield"
                type="number"
                step="1"
                min="0"
                value={form.expected_yield_kg || ''}
                onChange={(e) => setForm({ ...form, expected_yield_kg: parseFloat(e.target.value) || 0 })}
                aria-label={currentLang.expectedYield}
                placeholder="0"
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowAddForm(false)}>{currentLang.cancel}</button>
              <button type="submit" disabled={adding}>{adding ? '...' : currentLang.addCrop}</button>
            </div>
          </form>
        )}

        {yieldChartData && (
          <div className="yield-chart-section">
            <h3>{currentLang.yieldChart}</h3>
            <div className="yield-chart-container">
              <Bar
                data={yieldChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' },
                    title: { display: false },
                  },
                  scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'kg' } },
                    x: { title: { display: true, text: language === 'sw' ? 'Msimu' : 'Season' } },
                  },
                }}
                height={220}
              />
            </div>
          </div>
        )}

        {yields.length > 0 && (
          <div className="yield-by-farm-section">
            <h3>{currentLang.yieldByFarm}</h3>
            {Object.entries(yieldsByFarmSeason)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([key, recs]) => {
                const [farmId, seasonYear] = key.split('|');
                const farm = farms.find((f) => f.id === farmId);
                const total = recs.reduce((s, r) => s + r.actual_yield_kg, 0);
                return (
                  <div key={key} className="farm-season-yield-card">
                    <div className="farm-season-header">
                      <span>{farm?.name || farmId}</span>
                      <span className="season-badge">{seasonYear}</span>
                    </div>
                    <ul>
                      {recs.map((r) => (
                        <li key={r.id}>
                          {language === 'sw' ? (r.crop_swahili_name || r.crop_name) : r.crop_name}: {r.actual_yield_kg} {r.unit}
                        </li>
                      ))}
                    </ul>
                    <div className="farm-season-total">Total: {total} kg</div>
                  </div>
                );
              })}
          </div>
        )}

        <h3 className="crops-list-title">{currentLang.title}</h3>
        {loading ? (
          <div className="my-crops-loading">{language === 'sw' ? 'Inapakia...' : 'Loading...'}</div>
        ) : crops.length === 0 ? (
          <p className="no-crops-msg">{currentLang.noCrops}</p>
        ) : (
          <div className="crops-list">
            {crops.map((crop) => {
              const report = getCropReport(crop);
              const isReportOpen = selectedReport === crop.id;
              const displayName = language === 'sw' ? (crop.swahili_name || SWAHILI_NAMES[crop.name] || crop.name) : crop.name;
              return (
                <div key={crop.id} className="crop-report-card">
                  <div className="crop-card-header">
                    <span className="crop-display-name">🌾 {displayName}</span>
                    <span className="crop-badge">{crop.status}</span>
                  </div>
                  <div className="crop-card-meta">
                    <div>📅 {currentLang.planted}: {report.planted.toLocaleDateString()}</div>
                    <div>🌾 {currentLang.harvest}: {report.harvest.toLocaleDateString()}</div>
                    <div>📍 {currentLang.area}: {Number(crop.area_hectares) || 0} ha</div>
                    <div>⏳ {report.daysLeft} {currentLang.daysLeft}</div>
                  </div>
                  <div className="crop-yield-section">
                    <div className="yield-row">
                      <span className="yield-label">{currentLang.expectedYield}:</span>
                      {editingExpected === crop.id ? (
                        <span className="yield-edit">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={expectedYieldVal}
                            onChange={(e) => setExpectedYieldVal(e.target.value)}
                            autoFocus
                          />
                          <button type="button" onClick={() => handleSaveExpectedYield(crop.id)}>{language === 'sw' ? 'Hifadhi' : 'Save'}</button>
                          <button type="button" onClick={() => { setEditingExpected(null); setExpectedYieldVal(''); }}>{currentLang.cancel}</button>
                        </span>
                      ) : (
                        <span className="yield-value">
                          {crop.expected_yield_kg != null && crop.expected_yield_kg > 0 ? `${crop.expected_yield_kg} kg` : '—'}
                          <button type="button" className="yield-edit-btn" onClick={() => { setEditingExpected(crop.id); setExpectedYieldVal(String(crop.expected_yield_kg || '')); }}>✏️</button>
                        </span>
                      )}
                    </div>
                    {crop.actual_yield_kg != null && crop.actual_yield_kg > 0 && (
                      <div className="yield-row">
                        <span className="yield-label">{currentLang.currentYield}:</span>
                        <span className="yield-value">{crop.actual_yield_kg} kg</span>
                      </div>
                    )}
                    {yields.filter((y) => y.crop_id === crop.id).length > 0 && (
                      <div className="past-yields">
                        <span className="yield-label">{currentLang.pastYields} ({currentLang.perFarm}):</span>
                        <ul>
                          {yields.filter((y) => y.crop_id === crop.id).map((y) => (
                            <li key={y.id}>
                              {y.season_year} {y.season_label ? `(${y.season_label})` : ''}: {y.actual_yield_kg} {y.unit}
                              {y.harvest_date && ` · ${new Date(y.harvest_date).toLocaleDateString()}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button type="button" className="btn-record-yield" onClick={() => { setShowRecordYield(crop.id); setYieldForm({ ...yieldForm, crop_id: crop.id, farm_id: crop.farm_id }); }}>
                      📝 {currentLang.recordYield}
                    </button>
                  </div>
                  <div className="crop-progress-bar">
                    <div className="progress-fill" style={{ width: `${report.progressPct}%` }}></div>
                  </div>
                  <div className="crop-card-actions">
                    <button
                      type="button"
                      className="btn-view"
                      onClick={() => setSelectedReport(isReportOpen ? null : crop.id)}
                    >
                      {isReportOpen ? '▲' : '▼'} {currentLang.viewReport}
                    </button>
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => handleRemoveCrop(crop.id)}
                      disabled={deleting === crop.id}
                    >
                      {deleting === crop.id ? '...' : '🗑 ' + currentLang.remove}
                    </button>
                  </div>
                  {isReportOpen && (
                    <div className="crop-report-detail">
                      <h4>{currentLang.report}: {displayName}</h4>
                      <div className="report-timeline">
                        <div className="timeline-item">
                          <span className="timeline-label">{currentLang.planted}</span>
                          <span>{report.planted.toLocaleDateString()}</span>
                        </div>
                        <div className="timeline-item">
                          <span className="timeline-label">{currentLang.progress}</span>
                          <span>{report.progressPct.toFixed(0)}% ({report.elapsed}/{report.totalDays} {language === 'sw' ? 'siku' : 'days'})</span>
                        </div>
                        <div className="timeline-item">
                          <span className="timeline-label">{currentLang.harvest}</span>
                          <span>{report.harvest.toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showRecordYield && (
          <div className="record-yield-overlay" onClick={() => setShowRecordYield(null)}>
            <div className="record-yield-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{currentLang.recordYield}</h3>
              <form onSubmit={handleRecordYield}>
                <div className="form-row">
                  <label htmlFor="yield-season-year">{currentLang.season}</label>
                  <input
                    id="yield-season-year"
                    type="number"
                    min="2020"
                    max="2030"
                    value={yieldForm.season_year}
                    onChange={(e) => setYieldForm({ ...yieldForm, season_year: parseInt(e.target.value, 10) || new Date().getFullYear() })}
                    aria-label={currentLang.season}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="yield-harvest-date">{currentLang.harvest}</label>
                  <input
                    id="yield-harvest-date"
                    type="date"
                    value={yieldForm.harvest_date}
                    onChange={(e) => setYieldForm({ ...yieldForm, harvest_date: e.target.value })}
                    aria-label={currentLang.harvest}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="yield-actual">{currentLang.currentYield} (kg)</label>
                  <input
                    id="yield-actual"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={yieldForm.actual_yield_kg || ''}
                    onChange={(e) => setYieldForm({ ...yieldForm, actual_yield_kg: parseFloat(e.target.value) || 0 })}
                    required
                    aria-label={currentLang.currentYield}
                  />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowRecordYield(null)}>{currentLang.cancel}</button>
                  <button type="submit">{currentLang.recordYield}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate('/')}><i className="fas fa-home"></i><span>{currentLang.home}</span></div>
        <div className="nav-item" onClick={() => navigate('/sensors')}><i className="fas fa-tower-broadcast"></i><span>{language === 'sw' ? 'Vipima' : 'Sensors'}</span></div>
        <div className="nav-item" onClick={() => navigate('/robots')}><i className="fas fa-robot"></i><span>{language === 'sw' ? 'Roboti' : 'Robots'}</span></div>
        <div className="nav-item active"><i className="fas fa-seedling"></i><span>{currentLang.title}</span></div>
        <div className="nav-item" onClick={() => navigate('/profile')}><i className="fas fa-user"></i><span>{language === 'sw' ? 'Wasifu' : 'Profile'}</span></div>
      </nav>
    </div>
  );
};

export default MyCropsView;
