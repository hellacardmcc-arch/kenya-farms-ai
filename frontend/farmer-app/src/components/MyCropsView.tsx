import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { useLanguage } from '../context/LanguageContext';
import { getFarmerDashboard, addCrop, deleteCrop, updateCropExpectedYield, getYieldRecords, addYieldRecord, getApiErrorMessage, type Crop, type Farm, type YieldRecord } from '../api/farmerApi';
import LanguageSelector from './LanguageSelector';
import { AreaInput } from './AreaInput';
import { AreaDisplay } from './AreaDisplay';
import { useAreaUnit } from '../context/AreaUnitContext';
import { toDisplayValue } from '../utils/areaUtils';
import { AreaUnitSelector } from './AreaUnitSelector';
import FarmSelectorBar from './FarmSelectorBar';
import './MyCropsView.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SWAHILI_NAMES: Record<string, string> = { Maize: 'Mahindi', Tomatoes: 'Nyanya', Kale: 'Sukuma Wiki', Beans: 'Maharage' };

const MyCropsView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { areaUnit } = useAreaUnit();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const [yields, setYields] = useState<YieldRecord[]>([]);
  const [showRecordYield, setShowRecordYield] = useState<string | null>(null);
  const [editingExpected, setEditingExpected] = useState<string | null>(null);
  const [expectedYieldVal, setExpectedYieldVal] = useState<string>('');

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
    setLoadError(null);
    Promise.allSettled([getFarmerDashboard(token), getYieldRecords(token)])
      .then(([dResult, yResult]) => {
        const d = dResult.status === 'fulfilled' ? dResult.value : null;
        const y = yResult.status === 'fulfilled' ? yResult.value : [];
        if (d) {
          setCrops(d.crops || []);
          setFarms(d.farms || []);
        } else {
          setCrops([]);
          setFarms([]);
          const err = dResult.status === 'rejected' ? dResult.reason : null;
          const msg = err ? getApiErrorMessage(err, '') : '';
          setLoadError(msg || (language === 'sw' ? 'Imeshindwa kupakia' : 'Failed to load'));
        }
        setYields(Array.isArray(y) ? y : []);
      })
      .catch(() => { setCrops([]); setFarms([]); setYields([]); setLoadError(language === 'sw' ? 'Imeshindwa kupakia' : 'Failed to load'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const { availablePerFarm, totalAvailable, totalFarmsArea, totalAllocated } = React.useMemo(() => {
    const farmArea: Record<string, number> = {};
    const allocated: Record<string, number> = {};
    let totalFarms = 0;
    let totalAlloc = 0;
    for (const f of farms) {
      const ha = Number(f.area_hectares) || 0;
      farmArea[f.id] = ha;
      totalFarms += ha;
    }
    for (const c of crops) {
      const ha = Number(c.area_hectares) || 0;
      allocated[c.farm_id] = (allocated[c.farm_id] || 0) + ha;
      totalAlloc += ha;
    }
    const availablePerFarm: Record<string, number> = {};
    for (const f of farms) {
      availablePerFarm[f.id] = Math.max(0, (farmArea[f.id] || 0) - (allocated[f.id] || 0));
    }
    const totalAvailable = Math.max(0, totalFarms - totalAlloc);
    return { availablePerFarm, totalAvailable, totalFarmsArea: totalFarms, totalAllocated: totalAlloc };
  }, [farms, crops]);

  const availableForSelectedFarm = form.farm_id ? (availablePerFarm[form.farm_id] ?? 0) : 0;
  const hasNoLand = farms.length > 0 && totalAvailable <= 0;

  useEffect(() => {
    if (form.farm_id && availableForSelectedFarm >= 0) {
      const current = Number(form.area_hectares) || 0;
      if (current > availableForSelectedFarm) {
        setForm((prev) => ({ ...prev, area_hectares: Math.max(0.1, availableForSelectedFarm) }));
      }
    }
  }, [form.farm_id, form.area_hectares, availableForSelectedFarm]);

  const handleAddCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.farm_id || !form.name.trim()) {
      alert(language === 'sw' ? 'Chagua shamba na jina la mazao' : 'Select farm and crop name');
      return;
    }
    const requestedArea = Number(form.area_hectares) || 0;
    if (requestedArea <= 0) {
      alert(language === 'sw' ? 'Ingiza eneo halali' : 'Enter a valid area');
      return;
    }
    if (requestedArea > availableForSelectedFarm) {
      alert(language === 'sw'
        ? `Eneo linalohitajika (${requestedArea} ha) linazidi linalopatikana (${availableForSelectedFarm} ha). Badilisha au ongeza shamba.`
        : `Requested area (${requestedArea} ha) exceeds available (${availableForSelectedFarm} ha). Re-allocate or register more farm.`);
      return;
    }
    setAdding(true);
    setLoadError(null);
    try {
      const newCrop = await addCrop(token, {
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
      setLoadError(null);
      setCrops((prev) => [...prev, { ...newCrop, status: newCrop.status || 'growing' }]);
      alert(language === 'sw' ? 'Mazao yameongezwa!' : 'Crop added!');
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, language === 'sw' ? 'Imeshindwa kuongeza mazao' : 'Failed to add crop');
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
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, language === 'sw' ? 'Imeshindwa' : 'Failed'));
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
      alert(getApiErrorMessage(err, language === 'sw' ? 'Imeshindwa kuandika mavuno' : 'Failed to record yield'));
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
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, language === 'sw' ? 'Imeshindwa' : 'Failed'));
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
      expectedYield: 'Expected yield (kg)',
      currentYield: 'Current yield',
      pastYields: 'Past yields',
      recordYield: 'Record yield',
      perFarm: 'per farm',
      season: 'Season',
      yieldByFarm: 'Yield by farm & season',
      yieldChart: 'Past yield per crop per season',
      availableLand: 'Available on this farm',
      noLandAvailable: 'No more land available. Re-allocate crops or register more farms.',
      noLandOnFarm: 'No land available on this farm. Choose another farm or register more.',
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
      expectedYield: 'Matumaini ya mavuno (kg)',
      currentYield: 'Mavuno ya sasa',
      pastYields: 'Mavuno ya zamani',
      recordYield: 'Andika mavuno',
      perFarm: 'kwa shamba',
      season: 'Msimu',
      yieldByFarm: 'Mavuno kwa shamba na msimu',
      yieldChart: 'Mavuno ya zamani kwa mazao kwa msimu',
      availableLand: 'Inapatikana kwenye shamba hili',
      noLandAvailable: 'Hakuna ardhi zaidi. Badilisha ugawaji wa mazao au sajili shamba jipya.',
      noLandOnFarm: 'Hakuna ardhi kwenye shamba hili. Chagua shamba lingine au sajili zaidi.',
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
          <AreaUnitSelector />
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
          <button onClick={() => { logout(); navigate('/login'); }} className="header-btn">
            {language === 'sw' ? 'Toka' : 'Logout'}
          </button>
        </div>
      </header>

      <FarmSelectorBar />

      {loadError && (
        <div className="load-error-banner" role="alert">
          {loadError}
          <button type="button" onClick={load} className="retry-btn">Retry</button>
        </div>
      )}

      <div className="my-crops-content">
        <button onClick={() => navigate('/')} className="back-btn">
          ← {currentLang.back}
        </button>
        <h2 className="my-crops-title">{currentLang.subtitle}</h2>

        <button
          type="button"
          className={`add-crop-toggle ${showAddForm ? 'expanded' : ''}`}
          onClick={() => {
            if (farms.length === 0) {
              navigate('/farms');
            } else {
              setShowAddForm(!showAddForm);
              if (!showAddForm) {
                const firstWithLand = farms.find((f) => (availablePerFarm[f.id] ?? 0) > 0);
                const currentAvail = form.farm_id ? (availablePerFarm[form.farm_id] ?? 0) : 0;
                if (firstWithLand && currentAvail <= 0) {
                  const avail = availablePerFarm[firstWithLand.id] ?? 0;
                  setForm((prev) => ({ ...prev, farm_id: firstWithLand.id, area_hectares: Math.min(0.5, avail) }));
                }
              }
            }
          }}
        >
          <span>➕ {farms.length === 0 ? currentLang.addFarm : currentLang.addCrop}</span>
          <span className="toggle-icon">{showAddForm ? '▼' : '▶'}</span>
        </button>

        {farms.length === 0 && (
          <div className="no-farms-cta">
            <p className="no-farms-msg">{currentLang.noFarms}</p>
            <button type="button" className="btn-go-farms" onClick={() => navigate('/farms')}>
              {currentLang.addFarm} →
            </button>
          </div>
        )}

        {hasNoLand && (
          <div className="no-land-banner" role="alert">
            {currentLang.noLandAvailable}
            <div className="no-land-actions">
              <button type="button" onClick={() => navigate('/farms')}>
                {currentLang.addFarm}
              </button>
            </div>
          </div>
        )}

        {showAddForm && farms.length > 0 && (
          <form className="add-crop-form" onSubmit={handleAddCrop}>
            {form.farm_id && availableForSelectedFarm <= 0 && (
              <div className="no-land-on-farm-banner" role="alert">{currentLang.noLandOnFarm}</div>
            )}
            <div className="form-row">
              <label htmlFor="farm-select">{currentLang.selectFarm}</label>
              <select
                id="farm-select"
                value={form.farm_id}
                onChange={(e) => {
                  const fid = e.target.value;
                  const avail = fid ? (availablePerFarm[fid] ?? 0) : 0;
                  const current = Number(form.area_hectares) || 0.5;
                  const newArea = avail >= 0.1 ? Math.min(Math.max(0.1, current), avail) : 0;
                  setForm({ ...form, farm_id: fid, area_hectares: newArea });
                }}
                required
                aria-label={currentLang.selectFarm}
              >
                <option value="">{currentLang.selectFarm}</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name || f.id}{f.unique_code ? ` (${f.unique_code})` : ''}
                  </option>
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
            <AreaInput
              id="area-hectares"
              label={currentLang.area}
              value={form.area_hectares}
              onChange={(ha) => {
                const val = ha ?? 0;
                if (availableForSelectedFarm <= 0) return;
                const capped = Math.min(Math.max(0.1, val), availableForSelectedFarm);
                setForm({ ...form, area_hectares: capped });
              }}
              min={0.1}
              max={availableForSelectedFarm > 0 ? availableForSelectedFarm : undefined}
              hint={form.farm_id && availableForSelectedFarm >= 0
                ? `${currentLang.availableLand}: ${toDisplayValue(availableForSelectedFarm, areaUnit)} ${areaUnit}`
                : undefined}
            />
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
              <button type="submit" disabled={adding || availableForSelectedFarm <= 0}>
                {adding ? '...' : currentLang.addCrop}
              </button>
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
                    <div>📍 {currentLang.area}: <AreaDisplay hectares={crop.area_hectares} /></div>
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
        <div className="nav-item" onClick={() => navigate('/farms')}><i className="fas fa-tractor"></i><span>{language === 'sw' ? 'Mashamba' : 'Farms'}</span></div>
        <div className="nav-item" onClick={() => navigate('/profile')}><i className="fas fa-user"></i><span>{language === 'sw' ? 'Wasifu' : 'Profile'}</span></div>
      </nav>
    </div>
  );
};

export default MyCropsView;
