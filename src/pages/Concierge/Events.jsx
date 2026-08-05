import React, { useMemo, useState } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { Calendar, MapPin, Plus, Star, Search, Clock, Users } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import CustomDatePicker from '../../components/CustomDatePicker';
import { BACKEND_ORIGIN } from '../../utils/apiHelpers.js';

const BACKEND_URL = BACKEND_ORIGIN;
const toAbsoluteImageUrl = (rawPath) => {
  if (!rawPath) return null;
  if (String(rawPath).startsWith('http')) return rawPath;
  return `${BACKEND_URL}${String(rawPath).startsWith('/') ? '' : '/'}${rawPath}`;
};

const Events = () => {
  const {
    events = [],
    addEvent,
    updateEvent,
    deleteEvent,
    fetchClients,
    clients,
    customerUsers = [],
    fetchCustomerUsers,
    hasMenuPermission,
    currentUser
  } = useData();
  const canAddEvent = hasMenuPermission('Events', 'can_add');

  // Fetch supporting data once on mount — events are auto-polled by GlobalDataContext
  React.useEffect(() => {
    fetchClients();
    if (fetchCustomerUsers) fetchCustomerUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps — run once on mount only

  // Concierge should see tenant clients + signup customers (personal/business).
  const clientOptions = useMemo(() => {
    const ownCompanyId = currentUser?.company_id || currentUser?.companyId || null;
    const byCompany = (row) => {
      if (!ownCompanyId) return true;
      const rowCompany = row.company_id || row.companyId || row.client_id || row.clientId || null;
      if (rowCompany == null || rowCompany === '') return true;
      return String(rowCompany) === String(ownCompanyId);
    };

    const fromClients = (clients || [])
      .filter(byCompany)
      .map((c) => ({
        id: c.id,
        label: c.name || c.business_name || c.companyName || `Client ${c.id}`,
        email: c.email || '',
      }));

    const fromCustomerUsers = (customerUsers || [])
      .filter(byCompany)
      .map((u) => ({
        id: u.id,
        label: u.name || u.full_name || u.client_name || `Client ${u.id}`,
        email: u.email || '',
      }));

    const merged = [...fromClients, ...fromCustomerUsers];
    const seen = new Set();
    return merged.filter((o) => {
      const key = `${o.id}::${o.label}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [clients, customerUsers, currentUser?.company_id, currentUser?.companyId]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState({ title: '', client: '', client_id: '', date: '', location: '', status: 'Planning', guestCount: 0 });

  const filteredEvents = events.filter(e =>
    e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(e.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = (type, evt) => {
    setSelectedEvent(evt);
    setModalType(type);
    setFormData(evt.id ? { ...evt } : { title: '', client: '', client_id: '', date: '', location: '', status: 'Planning', guestCount: 0, plannerName: '', specialRequests: '' });
    setImageFile(null);
    const imgPath = evt.imageUrl || evt.image_url || null;
    setImagePreview(toAbsoluteImageUrl(imgPath));
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    // Date overlap warning (non-blocking)
    if (formData.date) {
      const overlapping = events.filter(e =>
        e.date === formData.date &&
        (modalType === 'add' || e.id !== selectedEvent?.id)
      );
      if (overlapping.length > 0) {
        const result = await swalConfirm('Overlap Warning',
          `"${overlapping[0].title}" is already scheduled on ${formData.date}. Still schedule?`
        );
        if (!result.isConfirmed) return;
      }
    }

    if (modalType === 'add') {
      addEvent({ ...formData, imageFile });
    } else if (modalType === 'edit') {
      updateEvent({ ...selectedEvent, ...formData, imageFile });
    }
    setIsModalOpen(false);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleDelete = () => {
    deleteEvent(selectedEvent.id);
    setIsModalOpen(false);
  };

  const columns = [
    { header: "Event ID", accessor: "id" },
    {
      header: "Client / Customer",
      accessor: "client_name",
      render: (row) => {
        const isGeneric = (str) => !str || ['person', 'personal client', 'personal', 'guest', 'client', 'null', 'undefined'].includes(String(str).trim().toLowerCase());
        const plannerStr = String(row.plannerName || row.planner_name || '').trim().toLowerCase();

        const matchedClient = (clients || []).find(c => String(c.id).replace('CLT-', '') === String(row.clientId || row.client_id).replace('CLT-', ''));
        const matchedUser = (customerUsers || []).find(u => String(u.id) === String(row.managerId || row.manager_id || row.clientId || row.client_id || row.userId || row.user_id));

        let clientName = null;
        if (!isGeneric(row.manager?.name)) {
          clientName = row.manager.name;
        } else if (matchedUser && !isGeneric(matchedUser.name || matchedUser.full_name)) {
          clientName = matchedUser.name || matchedUser.full_name;
        } else if (matchedClient && !isGeneric(matchedClient.contactPerson)) {
          clientName = matchedClient.contactPerson;
        } else if (!isGeneric(row.client?.contactPerson)) {
          clientName = row.client.contactPerson;
        } else if (matchedClient && !isGeneric(matchedClient.name || matchedClient.companyName)) {
          clientName = matchedClient.name || matchedClient.companyName;
        } else if (!isGeneric(row.client?.companyName)) {
          clientName = row.client.companyName;
        } else if (!isGeneric(row.client_name) && String(row.client_name).trim().toLowerCase() !== plannerStr) {
          clientName = row.client_name;
        } else if (!isGeneric(row.client?.name)) {
          clientName = row.client.name;
        } else if (!isGeneric(row.manager?.email)) {
          clientName = row.manager.email;
        }

        return clientName || "Personal Client";
      }
    },
    { header: "Event Title", accessor: "title" },
    { header: "Date", accessor: "date" },
    {
      header: "Moodboard Link",
      accessor: "moodBoardUrl",
      render: (row) => {
        const link = (row.moodBoardUrl || row.mood_board_url || '').trim();
        if (!link) return <span className="text-muted/40 text-xs italic">None</span>;
        const targetUrl = link.startsWith('http') ? link : `https://${link}`;
        return (
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 border border-accent/30 rounded-lg text-accent text-xs font-black uppercase tracking-wider hover:bg-accent hover:text-black transition-all shadow-sm"
          >
            <span>🔗 Open Link ↗</span>
          </a>
        );
      }
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => {
        const s = String(row.status || 'planned').toLowerCase();
        let label = "Planning";
        let colorClass = "bg-accent/20 text-accent";
        if (s === 'confirmed' || s === 'active') {
          label = "Active";
          colorClass = "bg-success/20 text-success";
        } else if (s === 'in_progress' || s === 'setup') {
          label = "Setup";
          colorClass = "bg-info/20 text-info";
        } else if (s === 'completed') {
          label = "Completed";
          colorClass = "bg-muted/20 text-muted";
        } else if (s === 'cancelled') {
          label = "Cancelled";
          colorClass = "bg-danger/20 text-danger";
        }
        return (
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${colorClass}`}>
            {label}
          </span>
        );
      }
    },
  ];

  const activeMoodLink = (formData.moodBoardUrl || formData.mood_board_url || '').trim();
  const formattedMoodLink = activeMoodLink ? (activeMoodLink.startsWith('http') ? activeMoodLink : `https://${activeMoodLink}`) : '';
  const isImageDirectLink = activeMoodLink && (/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(activeMoodLink) || activeMoodLink.includes('unsplash.com') || activeMoodLink.includes('imgur.com') || activeMoodLink.includes('images.') || activeMoodLink.includes('cdn.'));
  const displayImage = imagePreview || (isImageDirectLink ? formattedMoodLink : null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-0 sm:px-2">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Events Management</h1>
          <p className="text-secondary mt-1 text-sm">Coordinating luxury events and high-tier celebrations.</p>
        </div>
        <div className="flex flex-wrap sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <input
              type="text"
              placeholder="Search events..."
              className="bg-white/5 border border-border rounded-xl py-2 px-10 text-sm focus:outline-none focus:border-accent w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          </div>
          {canAddEvent && (
            <button className="btn-primary flex items-center gap-2" onClick={() => handleAction('add', {})}>
              <Plus size={16} /> Schedule Event
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-accent/10">
          <p className="text-xs text-secondary uppercase font-bold mb-1">Total Events</p>
          <p className="text-3xl font-bold">{events.length} Events</p>
        </div>
        <div className="glass-card p-6 border-accent/10">
          <p className="text-xs text-secondary uppercase font-bold mb-1">Total Guests</p>
          <p className="text-3xl font-bold">{events.reduce((sum, e) => sum + (parseInt(e.guestCount) || 0), 0)} Guests</p>
        </div>
        <div className="glass-card p-6 border-accent/10">
          <p className="text-xs text-secondary uppercase font-bold mb-1">Active Events</p>
          <p className="text-3xl font-bold">
            {events.filter(e => {
              const s = String(e.status || '').toLowerCase();
              return s === 'active' || s === 'confirmed' || s === 'in_progress' || s === 'setup';
            }).length} Active
          </p>
        </div>
      </div>

      <div className="glass-card p-6">
        <Table
          columns={columns}
          data={filteredEvents}
          actions={true}
          onView={(item) => handleAction('view', item)}
          onEdit={(item) => handleAction('edit', item)}
          onDelete={(item) => handleAction('delete', item)}
          canEdit={hasMenuPermission('Events', 'can_edit')}
          canDelete={hasMenuPermission('Events', 'can_delete')}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'view' ? 'Event Registry' :
            modalType === 'edit' ? 'Adjust Schedule' :
              modalType === 'delete' ? 'Cancel Event' : 'Schedule New Event'
        }
      >
        <div className="space-y-6">
          {modalType === 'delete' ? (
            <div className="space-y-4">
              <p className="text-secondary">Are you sure you want to cancel <span className="text-primary font-bold">{selectedEvent?.title}</span>? All related logs will be archived.</p>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">Keep Event</button>
                <button onClick={handleDelete} className="px-6 py-2 bg-danger text-white rounded-lg font-bold">Confirm Cancellation</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Event Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>

                {/* Client Selection */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Client</label>
                  <select
                    value={formData.client_id || ''}
                    onChange={(e) => {
                      const selected = clientOptions.find(c => String(c.id) === String(e.target.value));
                      setFormData({ ...formData, client_id: e.target.value, client: selected?.label || '' });
                    }}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option value="">Select Client...</option>
                    {clientOptions.map(c => (
                      <option key={c.id} value={c.id}>{c.label} {c.email ? `(${c.email})` : ''}</option>
                    ))}
                  </select>
                  {clientOptions.length === 0 && (
                    <p className="text-[10px] text-warning mt-1">
                      No clients found for your company. Ask admin to create clients/customers first.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Event Date</label>
                  <CustomDatePicker
                    selectedDate={formData.date}
                    onChange={(date) => setFormData({ ...formData, date })}
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Expected Guests</label>
                  <input
                    type="number"
                    value={formData.guestCount}
                    onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Event Planner Name</label>
                  <input
                    type="text"
                    value={formData.plannerName || ''}
                    onChange={(e) => setFormData({ ...formData, plannerName: e.target.value })}
                    placeholder="Enter planner name"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>

                {/* Image Upload & Moodboard Auto-Preview */}
                <div className="col-span-1 md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Inspirational Picture / Moodboard</label>
                  {modalType !== 'view' ? (
                    <label className="block border border-dashed border-border rounded-lg p-4 text-center hover:border-accent/50 cursor-pointer transition-colors relative">
                      {displayImage ? (
                        <div className="space-y-2">
                          <img src={displayImage} alt="Preview" className="max-h-40 mx-auto rounded-lg object-cover border border-white/10 shadow-lg" />
                          <p className="text-[10px] text-accent font-bold uppercase">Click to change local image</p>
                        </div>
                      ) : formattedMoodLink ? (
                        <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-2 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-accent uppercase tracking-wider flex items-center gap-1.5">
                              🔗 External Mood Board Link Attached
                            </span>
                            <a
                              href={formattedMoodLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 bg-accent text-black font-black text-[10px] uppercase tracking-wider rounded-lg hover:bg-accent/80 transition-all shadow-md"
                            >
                              Open Link in New Tab ↗
                            </a>
                          </div>
                          <p className="text-xs text-secondary truncate font-mono">{activeMoodLink}</p>
                          <p className="text-[10px] text-muted italic">Click container below if you wish to upload an explicit image file override.</p>
                        </div>
                      ) : (
                        <div className="py-4">
                          <p className="text-xs text-secondary italic">Click to upload image (JPG, PNG, GIF) or paste Mood Board Link below</p>
                          <p className="text-[10px] text-muted mt-1">Max 5MB</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setImageFile(file);
                            setImagePreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                  ) : displayImage ? (
                    <img src={displayImage} alt="Event" className="max-h-48 rounded-lg object-cover border border-white/10 shadow-lg" />
                  ) : formattedMoodLink ? (
                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-accent uppercase tracking-wider">🔗 Mood Board Link</p>
                        <p className="text-xs text-secondary truncate mt-0.5">{activeMoodLink}</p>
                      </div>
                      <a
                        href={formattedMoodLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-accent text-black font-black text-xs uppercase tracking-wider rounded-lg hover:bg-accent/80 transition-all shrink-0 shadow-md"
                      >
                        Open ↗
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic p-4 bg-white/5 rounded-lg">No image or moodboard link provided</p>
                  )}
                </div>

                {/* Client Mood Board Link */}
                <div className="col-span-1 md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Mood Board Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.moodBoardUrl || formData.mood_board_url || ''}
                      onChange={(e) => setFormData({ ...formData, moodBoardUrl: e.target.value })}
                      placeholder="https://pinterest.com/..."
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                      disabled={modalType === 'view'}
                    />
                    {formattedMoodLink && (
                      <a
                        href={formattedMoodLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-accent text-black font-black text-xs uppercase tracking-wider rounded-lg hover:bg-accent/80 transition-all flex items-center gap-1 shrink-0 shadow-md"
                      >
                        Open ↗
                      </a>
                    )}
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Special Requests & Notes</label>
                  <textarea
                    value={formData.specialRequests || ''}
                    onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                    placeholder="Bespoke requests, dietary restrictions, etc."
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none min-h-[100px]"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option value="planned">Planning</option>
                    <option value="confirmed">Confirmed / Active</option>
                    <option value="in_progress">In Progress / Setup</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {modalType === 'view' && (
                <div className="mt-6 space-y-3">
                  <h5 className="text-xs font-bold text-accent uppercase tracking-widest">Protocol Details</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-border">
                      <Users size={16} className="text-secondary" />
                      <div>
                        <p className="text-[10px] text-muted uppercase font-bold">Planned Attendance</p>
                        <p className="text-sm font-bold">{formData.guestCount || 0} Guests</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-border">
                      <Star size={16} className="text-secondary" />
                      <div>
                        <p className="text-[10px] text-muted uppercase font-bold">Event Planner</p>
                        <p className="text-sm font-bold">{formData.plannerName || 'Not Assigned'}</p>
                      </div>
                    </div>
                  </div>
                  {formData.specialRequests && (
                    <div className="p-3 bg-white/5 rounded-xl border border-border">
                      <p className="text-[10px] text-muted uppercase font-bold mb-1">Special Requests & Notes</p>
                      <p className="text-sm text-secondary whitespace-pre-wrap">{formData.specialRequests}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
                {modalType !== 'view' && <button onClick={handleSave} className="btn-primary">Finalize Schedule</button>}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Events;

