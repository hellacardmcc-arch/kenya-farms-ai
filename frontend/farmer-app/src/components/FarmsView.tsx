import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getFarmerDashboard,
  createFarm,
  updateFarm,
  deleteFarm,
  getApiErrorMessage,
  type Farm,
  type Crop,
  type CreateFarmPayload,
} from '../api/farmerApi';
import LanguageSelector from './LanguageSelector';
import { AreaInput } from './AreaInput';
import { AreaDisplay } from './AreaDisplay';
import { AreaUnitSelector } from './AreaUnitSelector';
import FarmSelectorBar from './FarmSelectorBar';
import './FarmsView.css';

const FarmsView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const { refreshFarms } = useFarm();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [viewingFarm, setViewingFarm] = useState<Farm | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [farmForm, setFarmForm] = useState({
    name: '',
    location: '',
    area_hectares: 0.5,
    latitude: '',
    longitude: '',
  });

  const load = () => {
    if (!token) return;
    getFarmerDashboard(token)
      .then((d) => {
        setFarms(d.farms || []);
        setCrops(d.crops || []);
      })
      .catch(() => {
        setFarms([]);
        setCrops([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const getCropsForFarm = (farmId: string) => crops.filter((c) => c.farm_id === farmId);

  const handleAddFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      alert(language === 'sw' ? 'Tafadhali ingia tena' : 'Please log in again');
      return;
    }
    const name = farmForm.name?.trim() ?? '';
    if (!name) {
      alert(language === 'sw' ? 'Ingiza jina la shamba' : 'Enter farm name');
      return;
    }
    const area = farmForm.area_hectares != null ? Number(farmForm.area_hectares) : 0.5;
    if (Number.isNaN(area) || area < 0) {
      alert(language === 'sw' ? 'Eneo lazima liwe nambari halali na chanya' : 'Area must be a valid positive number');
      return;
    }
    setAdding(true);
    try {
      const payload: CreateFarmPayload = {
        name,
        area_hectares: area >= 0 ? area : 0.5,
      };
      if (farmForm.location?.trim()) payload.location = farmForm.location.trim();
      const lat = farmForm.latitude ? Number(farmForm.latitude) : NaN;
      const lng = farmForm.longitude ? Number(farmForm.longitude) : NaN;
      if (!Number.isNaN(lat) && lat >= -90 && lat <= 90) payload.latitude = lat;
      if (!Number.isNaN(lng) && lng >= -180 && lng <= 180) payload.longitude = lng;
      await createFarm(token, payload);
      await refreshFarms();
      await load();
      setFarmForm({ name: '', location: '', area_hectares: 0.5, latitude: '', longitude: '' });
      setShowAddForm(false);
      alert(language === 'sw' ? 'Shamba limeongezwa kikamilifu!' : 'Farm added successfully!');
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, language === 'sw' ? 'Imeshindwa kuhifadhi shamba' : 'Failed to save farm'));
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingFarm || !farmForm.name.trim()) return;
    const area = Number(farmForm.area_hectares);
    if (Number.isNaN(area) || area < 0) {
      alert(language === 'sw' ? 'Eneo lazima liwe nambari halali na chanya' : 'Area must be a valid positive number');
      return;
    }
    setSaving(true);
    try {
      const payload: { name: string; location?: string; area_hectares?: number; latitude?: number; longitude?: number } = {
        name: farmForm.name.trim(),
      };
      if (farmForm.location?.trim()) payload.location = farmForm.location.trim();
      payload.area_hectares = area;
      const lat = Number(farmForm.latitude);
      const lng = Number(farmForm.longitude);
      if (!Number.isNaN(lat)) payload.latitude = lat;
      if (!Number.isNaN(lng)) payload.longitude = lng;
      await updateFarm(token, editingFarm.id, payload);
      await refreshFarms();
      await load();
      setEditingFarm(null);
      setFarmForm({ name: '', location: '', area_hectares: 0.5, latitude: '', longitude: '' });
      alert(language === 'sw' ? 'Shamba limehifadhiwa!' : 'Farm updated!');
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, language === 'sw' ? 'Imeshindwa' : 'Failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFarm = async (farm: Farm) => {
    if (!token) return;
    const farmCrops = getCropsForFarm(farm.id);
    const msg =
      language === 'sw'
        ? farmCrops.length > 0
          ? `Shamba "${farm.name || farm.id}" lina mazao ${farmCrops.length}. Kufuta shamba kutafuta mazao yote. Una uhakika?`
          : `Una uhakika unataka kufuta shamba "${farm.name || farm.id}"?`
        : farmCrops.length > 0
          ? `Farm "${farm.name || farm.id}" has ${farmCrops.length} crop(s). Deleting will remove all crops. Are you sure?`
          : `Are you sure you want to remove farm "${farm.name || farm.id}"?`;
    if (!confirm(msg)) return;
    setDeleting(farm.id);
    try {
      await deleteFarm(token, farm.id);
      await refreshFarms();
      await load();
      setViewingFarm(null);
      setEditingFarm(null);
      alert(language === 'sw' ? 'Shamba limefutwa' : 'Farm removed');
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, language === 'sw' ? 'Imeshindwa' : 'Failed'));
    } finally {
      setDeleting(null);
    }
  };

  const openEdit = (farm: Farm) => {
    setEditingFarm(farm);
    setFarmForm({
      name: farm.name || '',
      location: farm.location || '',
      area_hectares: farm.area_hectares ?? 0.5,
      latitude: farm.latitude != null ? String(farm.latitude) : '',
      longitude: farm.longitude != null ? String(farm.longitude) : '',
    });
    setViewingFarm(null);
  };

  const t = {
    en: {
      title: 'My Farms',
      subtitle: 'Add, edit, view, and manage all your farms',
      addFarm: 'Add Farm',
      edit: 'Edit',
      view: 'View',
      remove: 'Remove',
      back: 'Back',
      farmName: 'Farm name',
      farmLocation: 'Location (optional)',
      coordinates: 'Coordinates (optional)',
      latitude: 'Latitude',
      longitude: 'Longitude',
      area: 'Area',
      uniqueCode: 'Farm code',
      uniqueCodeAuto: 'Unique farm code will be auto-generated.',
      cancel: 'Cancel',
      noFarms: 'No farms yet. Add your first farm!',
      cropsCount: 'crops',
      save: 'Save',
      close: 'Close',
    },
    sw: {
      title: 'Mashamba Yangu',
      subtitle: 'Ongeza, hariri, angalia, na udhibiti mashamba yako yote',
      addFarm: 'Ongeza Shamba',
      edit: 'Hariri',
      view: 'Angalia',
      remove: 'Futa',
      back: 'Rudi',
      farmName: 'Jina la shamba',
      farmLocation: 'Mahali (si lazima)',
      coordinates: 'Vipengele (si lazima)',
      latitude: 'Latitudo',
      longitude: 'Longitudo',
      area: 'Eneo',
      uniqueCode: 'Msimbo wa shamba',
      uniqueCodeAuto: 'Msimbo wa shamba utazalishwa kiotomatiki.',
      cancel: 'Ghairi',
      noFarms: 'Hakuna mashamba bado. Ongeza shamba lako la kwanza!',
      cropsCount: 'mazao',
      save: 'Hifadhi',
      close: 'Funga',
    },
  };

  const currentLang = t[language];

  return (
    <div className="farms-view farmer-dashboard">
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

      <div className="farms-content">
        <button onClick={() => navigate('/')} className="back-btn">
          ← {currentLang.back}
        </button>
        <h2 className="farms-title">{currentLang.subtitle}</h2>

        <button
          type="button"
          className="add-farm-btn-main"
          onClick={() => {
            setShowAddForm(true);
            setEditingFarm(null);
            setViewingFarm(null);
            setFarmForm({ name: '', location: '', area_hectares: 0.5, latitude: '', longitude: '' });
          }}
        >
          ➕ {currentLang.addFarm}
        </button>

        {loading ? (
          <div className="farms-loading">{language === 'sw' ? 'Inapakia...' : 'Loading...'}</div>
        ) : farms.length === 0 ? (
          <p className="no-farms-msg">{currentLang.noFarms}</p>
        ) : (
          <div className="farms-list">
            {farms.map((farm) => {
              const farmCrops = getCropsForFarm(farm.id);
              const isViewing = viewingFarm?.id === farm.id;
              return (
                <div key={farm.id} className={`farm-card ${isViewing ? 'expanded' : ''}`}>
                  <div className="farm-card-header" onClick={() => setViewingFarm(isViewing ? null : farm)}>
                    <div className="farm-card-title">
                      <span className="farm-name">🌾 {farm.name || farm.unique_code || farm.id}</span>
                      <span className="farm-area">
                        <AreaDisplay hectares={farm.area_hectares ?? 0} />
                      </span>
                    </div>
                    <span className="farm-crops-badge">
                      {farmCrops.length} {currentLang.cropsCount}
                    </span>
                    <span className="expand-icon">{isViewing ? '▲' : '▼'}</span>
                  </div>
                  <div className="farm-card-actions">
                    <button type="button" className="btn-edit" onClick={() => openEdit(farm)}>
                      ✏️ {currentLang.edit}
                    </button>
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => handleRemoveFarm(farm)}
                      disabled={deleting === farm.id}
                    >
                      {deleting === farm.id ? '...' : '🗑 ' + currentLang.remove}
                    </button>
                  </div>
                  {isViewing && (
                    <div className="farm-card-detail">
                      <div className="farm-detail-row">
                        <span className="label">{currentLang.farmName}:</span>
                        <span>{farm.name || '—'}</span>
                      </div>
                      <div className="farm-detail-row">
                        <span className="label">{currentLang.farmLocation}:</span>
                        <span>{farm.location || '—'}</span>
                      </div>
                      <div className="farm-detail-row">
                        <span className="label">{currentLang.area}:</span>
                        <span>
                          <AreaDisplay hectares={farm.area_hectares ?? 0} />
                        </span>
                      </div>
                      {farm.unique_code && (
                        <div className="farm-detail-row">
                          <span className="label">{currentLang.uniqueCode}:</span>
                          <span>{farm.unique_code}</span>
                        </div>
                      )}
                      {(farm.latitude != null || farm.longitude != null) && (
                        <div className="farm-detail-row">
                          <span className="label">{currentLang.coordinates}:</span>
                          <span>
                            {farm.latitude}, {farm.longitude}
                          </span>
                        </div>
                      )}
                      {farmCrops.length > 0 && (
                        <div className="farm-crops-list">
                          <span className="label">{currentLang.cropsCount}:</span>
                          <ul>
                            {farmCrops.map((c) => (
                              <li key={c.id}>
                                {language === 'sw' ? (c.swahili_name || c.name) : c.name} ·{' '}
                                <AreaDisplay hectares={c.area_hectares ?? 0} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <button type="button" className="btn-go-crops" onClick={() => navigate('/crops')}>
                        {language === 'sw' ? 'Angalia Mazao' : 'View Crops'} →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showAddForm && (
          <div className="farm-form-overlay" onClick={() => setShowAddForm(false)}>
            <div className="farm-form-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{currentLang.addFarm}</h3>
              <form className="add-farm-form" onSubmit={handleAddFarm}>
                <div className="form-row">
                  <label htmlFor="farm-name">{currentLang.farmName}</label>
                  <input
                    id="farm-name"
                    type="text"
                    value={farmForm.name}
                    onChange={(e) => setFarmForm({ ...farmForm, name: e.target.value })}
                    required
                    placeholder={currentLang.farmName}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="farm-location">{currentLang.farmLocation}</label>
                  <input
                    id="farm-location"
                    type="text"
                    value={farmForm.location}
                    onChange={(e) => setFarmForm({ ...farmForm, location: e.target.value })}
                    placeholder={currentLang.farmLocation}
                  />
                </div>
                <AreaInput
                  id="farm-area"
                  label={currentLang.area}
                  value={farmForm.area_hectares}
                  onChange={(ha) => setFarmForm({ ...farmForm, area_hectares: ha ?? 0.5 })}
                  min={0}
                />
                <div className="form-row form-row-coords">
                  <label>{currentLang.coordinates}</label>
                  <div className="coords-inputs">
                    <input
                      id="farm-lat"
                      type="number"
                      step="any"
                      placeholder={currentLang.latitude}
                      value={farmForm.latitude}
                      onChange={(e) => setFarmForm({ ...farmForm, latitude: e.target.value })}
                      aria-label={currentLang.latitude}
                    />
                    <input
                      id="farm-lng"
                      type="number"
                      step="any"
                      placeholder={currentLang.longitude}
                      value={farmForm.longitude}
                      onChange={(e) => setFarmForm({ ...farmForm, longitude: e.target.value })}
                      aria-label={currentLang.longitude}
                    />
                  </div>
                </div>
                <p className="form-hint">{currentLang.uniqueCodeAuto}</p>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowAddForm(false)}>
                    {currentLang.cancel}
                  </button>
                  <button type="submit" disabled={adding}>
                    {adding ? '...' : currentLang.addFarm}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingFarm && (
          <div className="farm-form-overlay" onClick={() => setEditingFarm(null)}>
            <div className="farm-form-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{currentLang.edit} — {editingFarm.name || editingFarm.id}</h3>
              <form className="add-farm-form" onSubmit={handleUpdateFarm}>
                <div className="form-row">
                  <label htmlFor="edit-farm-name">{currentLang.farmName}</label>
                  <input
                    id="edit-farm-name"
                    type="text"
                    value={farmForm.name}
                    onChange={(e) => setFarmForm({ ...farmForm, name: e.target.value })}
                    required
                    placeholder={currentLang.farmName}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="edit-farm-location">{currentLang.farmLocation}</label>
                  <input
                    id="edit-farm-location"
                    type="text"
                    value={farmForm.location}
                    onChange={(e) => setFarmForm({ ...farmForm, location: e.target.value })}
                    placeholder={currentLang.farmLocation}
                  />
                </div>
                <AreaInput
                  id="edit-farm-area"
                  label={currentLang.area}
                  value={farmForm.area_hectares}
                  onChange={(ha) => setFarmForm({ ...farmForm, area_hectares: ha ?? 0.5 })}
                  min={0}
                />
                <div className="form-row form-row-coords">
                  <label>{currentLang.coordinates}</label>
                  <div className="coords-inputs">
                    <input
                      id="edit-farm-lat"
                      type="number"
                      step="any"
                      placeholder={currentLang.latitude}
                      value={farmForm.latitude}
                      onChange={(e) => setFarmForm({ ...farmForm, latitude: e.target.value })}
                      aria-label={currentLang.latitude}
                    />
                    <input
                      id="edit-farm-lng"
                      type="number"
                      step="any"
                      placeholder={currentLang.longitude}
                      value={farmForm.longitude}
                      onChange={(e) => setFarmForm({ ...farmForm, longitude: e.target.value })}
                      aria-label={currentLang.longitude}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setEditingFarm(null)}>
                    {currentLang.cancel}
                  </button>
                  <button type="submit" disabled={saving}>
                    {saving ? '...' : currentLang.save}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate('/')}>
          <i className="fas fa-home"></i>
          <span>{language === 'sw' ? 'Nyumbani' : 'Home'}</span>
        </div>
        <div className="nav-item" onClick={() => navigate('/sensors')}>
          <i className="fas fa-tower-broadcast"></i>
          <span>{language === 'sw' ? 'Vipima' : 'Sensors'}</span>
        </div>
        <div className="nav-item" onClick={() => navigate('/robots')}>
          <i className="fas fa-robot"></i>
          <span>{language === 'sw' ? 'Roboti' : 'Robots'}</span>
        </div>
        <div className="nav-item" onClick={() => navigate('/crops')}>
          <i className="fas fa-seedling"></i>
          <span>{language === 'sw' ? 'Mazao' : 'Crops'}</span>
        </div>
        <div className="nav-item active">
          <i className="fas fa-tractor"></i>
          <span>{currentLang.title}</span>
        </div>
        <div className="nav-item" onClick={() => navigate('/profile')}>
          <i className="fas fa-user"></i>
          <span>{language === 'sw' ? 'Wasifu' : 'Profile'}</span>
        </div>
      </nav>
    </div>
  );
};

export default FarmsView;
