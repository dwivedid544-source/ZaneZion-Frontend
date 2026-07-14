import React, { useState } from 'react';
import Modal from '../../components/Modal';
import CustomDatePicker from '../../components/CustomDatePicker';
import { useData } from '../../context/GlobalDataContext';
import { Calendar, Plus, Clock, Star, MapPin, Search, Trash2, Edit, Users } from 'lucide-react';

const ClientEvents = () => {
    const { events = [], addEvent, updateEvent, deleteEvent, currentUser, clients } = useData();

    const clientName = currentUser?.name || 'Current Client';
    // Find the company record for this user so we can match events by company name
    const myCompany = (clients || []).find(c => {
        const cId = String(c.id).replace('CLT-', '');
        const uId = String(currentUser?.clientId).replace('CLT-', '');
        return (currentUser?.clientId && cId === uId) ||
            String(c.id) === String(currentUser?.company_id) ||
            (currentUser?.email && c.email?.toLowerCase() === currentUser?.email?.toLowerCase());
    });
    const companyName = myCompany?.name;
    const initialFormData = { title: '', date: '', location: '', locationType: 'Private Residence', guests: 10, type: 'Private', specialRequests: '', plannerName: '', moodBoard: '' };
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('add'); // 'add', 'view' or 'edit'
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [formData, setFormData] = useState(initialFormData);

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedEvent(null);
        setFormData(initialFormData);
    };

    const handleOpenModal = (type, evt = null) => {
        setModalType(type);
        setSelectedEvent(evt);
        if ((type === 'view' || type === 'edit') && evt) {
            const standardTypes = ['Private Residence', 'Yacht / Onboard', 'Luxury Resort', 'Secret Beach'];
            const isStandard = standardTypes.includes(evt.location);

            setFormData({
                ...evt,
                locationType: isStandard ? evt.location : (evt.location ? 'Other' : 'Private Residence'),
                guests: evt.guestCount || evt.guests || 10,
                moodBoard: evt.moodBoardUrl || evt.moodBoard || ''
            });
        } else {
            setFormData(initialFormData);
        }
        setIsModalOpen(true);
    };

    const formatDateForApi = (d) => {
        if (!d) return '';
        // If it's a Date object
        if (d instanceof Date) return d.toISOString().split('T')[0];
        // If it's like '24-5-2026' or '2026-05-24', try to normalize
        const s = String(d);
        if (/\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
        // try D-M-YYYY
        const parts = s.split(/[-\/]/).map(p => p.trim());
        if (parts.length === 3) {
            // detect if first part is year
            if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            // assume D-M-YYYY
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return s;
    };

    const handleSave = () => {
        const companyIntId = myCompany?.id
            ? parseInt(String(myCompany.id).replace('CLT-', ''))
            : (currentUser?.company_id ? parseInt(currentUser.company_id) : null);

        const normalizedLocation = formData.locationType === 'Other'
            ? formData.location
            : formData.locationType;

        if (modalType === 'add') {
            const payload = {
                title: formData.title,
                date: formatDateForApi(formData.date),
                location: normalizedLocation,
                guestCount: formData.guests || formData.guestCount || 0,
                plannerName: formData.plannerName || '',
                specialRequests: formData.specialRequests || '',
                moodBoardUrl: formData.moodBoard || '',
                client: companyName || clientName,
                client_id: companyIntId,
                status: 'planned',
            };

            addEvent({
                ...payload,
                createdAt: new Date().toISOString()
            });
            handleCloseModal();
            return;
        }

        if (modalType === 'edit' && selectedEvent) {
            const payload = {
                id: selectedEvent.id,
                title: formData.title,
                date: formatDateForApi(formData.date),
                location: normalizedLocation,
                guestCount: formData.guests || formData.guestCount || 0,
                plannerName: formData.plannerName || '',
                specialRequests: formData.specialRequests || '',
                moodBoardUrl: formData.moodBoard || ''
            };

            updateEvent(payload);
            handleCloseModal();
            return;
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Event Concierge</h1>
                    <p className="text-secondary mt-1">Book and manage your bespoke events, celebrations, and gatherings.</p>
                </div>
                <button
                    onClick={() => handleOpenModal('add')}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={16} /> Request New Event
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.filter(e => {
                    const cleanEventClientId = e.client_id ? String(e.client_id).replace('CLT-', '') : '';
                    const cleanMyCompanyId = myCompany?.id ? String(myCompany.id).replace('CLT-', '') : '';
                    const cleanUserCompanyId = currentUser?.company_id ? String(currentUser.company_id).replace('CLT-', '') : '';
                    const cleanUserClientId = currentUser?.clientId ? String(currentUser.clientId).replace('CLT-', '') : '';

                    const matchesClientId = (cleanEventClientId && (
                        cleanEventClientId === cleanMyCompanyId ||
                        cleanEventClientId === cleanUserCompanyId ||
                        cleanEventClientId === cleanUserClientId ||
                        String(cleanEventClientId) === String(currentUser?.id)
                    ));

                    const matchesCompanyId = (e.company_id && (
                        String(e.company_id).replace('CLT-', '') === cleanMyCompanyId ||
                        String(e.company_id).replace('CLT-', '') === cleanUserCompanyId ||
                        String(e.company_id).replace('CLT-', '') === cleanUserClientId
                    ));

                    const matchesName = (
                        (e.client && (e.client === clientName || (companyName && e.client === companyName))) ||
                        (e.client_name && (e.client_name === clientName || (companyName && e.client_name === companyName)))
                    );

                    const matchesManager = (
                        e.manager_id && String(e.manager_id) === String(currentUser?.id)
                    );

                    const isOperational = (
                        e.client === 'Current Client' ||
                        e.client === 'Operational Client' ||
                        e.client_name === 'Current Client' ||
                        e.client_name === 'Operational Client'
                    );

                    return matchesClientId || matchesCompanyId || matchesName || matchesManager || isOperational;
                }).map((evt, index) => (
                    <div key={`${evt.id}-${index}`} className="glass-card p-6 border-accent/10 group hover:border-accent/40 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center text-accent">
                                <Star size={24} />
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${String(evt.status).toLowerCase() === 'confirmed' || String(evt.status).toLowerCase() === 'active'
                                ? 'bg-success/20 text-success'
                                : String(evt.status).toLowerCase() === 'completed'
                                    ? 'bg-muted/20 text-muted'
                                    : String(evt.status).toLowerCase() === 'cancelled'
                                        ? 'bg-danger/20 text-danger'
                                        : String(evt.status).toLowerCase().includes('progress')
                                            ? 'bg-info/20 text-info'
                                            : 'bg-warning/20 text-warning'
                                }`}>
                                {evt.status}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold mb-1">{evt.title}</h3>
                        <div className="space-y-2 mt-4 text-xs text-secondary">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-accent" />
                                <span>{evt.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-accent" />
                                <span>{evt.location}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6 transition-all">
                            <button
                                onClick={() => handleOpenModal('view', evt)}
                                className="flex-1 btn-secondary py-2 text-[10px] font-bold uppercase"
                            >
                                View
                            </button>
                            <button
                                onClick={() => handleOpenModal('edit', evt)}
                                className="px-3 py-2 bg-accent/10 border border-accent/20 text-accent rounded-lg hover:bg-accent hover:text-black transition-all"
                                title="Edit Event"
                            >
                                <Edit size={14} />
                            </button>
                            <button
                                onClick={() => { if (window.confirm('Delete this event?')) deleteEvent(evt.id); }}
                                className="px-3 py-2 bg-danger/10 border border-danger/20 text-danger rounded-lg hover:bg-danger hover:text-white transition-all"
                                title="Delete Event"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={modalType === 'view' ? 'Event Details' : modalType === 'edit' ? 'Edit Event' : 'Request Event Consultation'}
            >
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase text-accent">Event Title / Purpose</label>
                        <input
                            type="text"
                            placeholder="e.g. Birthday Celebration on Private Yacht"
                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            disabled={modalType === 'view'}
                        />
                    </div>
                    {modalType === 'view' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-border">
                                <Star size={16} className="text-accent" />
                                <div>
                                    <p className="text-[10px] text-muted uppercase font-bold">Current Status</p>
                                    <p className={`text-sm font-bold uppercase ${String(formData.status).toLowerCase() === 'confirmed' ? 'text-success' : String(formData.status).toLowerCase().includes('progress') ? 'text-info' : String(formData.status).toLowerCase() === 'cancelled' ? 'text-danger' : String(formData.status).toLowerCase() === 'completed' ? 'text-muted' : 'text-warning'}`}>
                                        {formData.status || 'Planning'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-border">
                                <Users size={16} className="text-secondary" />
                                <div>
                                    <p className="text-[10px] text-muted uppercase font-bold">Planned Attendance</p>
                                    <p className="text-sm font-bold">{formData.guestCount || 0} Guests</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-border md:col-span-2">
                                <Star size={16} className="text-secondary" />
                                <div>
                                    <p className="text-[10px] text-muted uppercase font-bold">Event Planner</p>
                                    <p className="text-sm font-bold">{formData.plannerName || 'Not Assigned'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {modalType === 'view' && formData.specialRequests && (
                        <div className="p-3 bg-white/5 rounded-xl border border-border">
                            <p className="text-[10px] text-muted uppercase font-bold mb-1">Special Requests & Notes</p>
                            <p className="text-sm text-secondary whitespace-pre-wrap">{formData.specialRequests}</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase">Requested Date</label>
                            <CustomDatePicker
                                selectedDate={formData.date}
                                onChange={(date) => setFormData({ ...formData, date })}
                                disabled={modalType === 'view'}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Expected Guest Count</label>
                            <input
                                type="number"
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold text-white shadow-inner"
                                value={formData.guests}
                                onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
                                placeholder="Min. 10"
                                disabled={modalType === 'view'}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Event Planner Name</label>
                            <input
                                type="text"
                                placeholder="Leave blank if ZaneZion handles planning"
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold text-white shadow-inner"
                                value={formData.plannerName}
                                onChange={(e) => setFormData({ ...formData, plannerName: e.target.value })}
                                disabled={modalType === 'view'}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest text-accent">Mood Board / Inspiration (URL)</label>
                            {modalType === 'view' && formData.moodBoard ? (
                                <a
                                    href={(formData.moodBoard || '').trim().startsWith('http') ? (formData.moodBoard || '').trim() : `https://${(formData.moodBoard || '').trim()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 text-sm font-bold text-accent hover:bg-accent/10 transition-all truncate"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    🔗 {(formData.moodBoard || '').trim()}
                                </a>
                            ) : (
                                <input
                                    type="url"
                                    placeholder="https://pinterest.com/your-board or any link"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none font-bold text-white shadow-inner"
                                    value={formData.moodBoard}
                                    onChange={(e) => setFormData({ ...formData, moodBoard: e.target.value })}
                                    disabled={modalType === 'view'}
                                />
                            )}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase text-accent">Preferred Location Type</label>
                        <select
                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                            value={formData.locationType || 'Private Residence'}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFormData({
                                    ...formData,
                                    locationType: val,
                                    location: val === 'Other' ? '' : val
                                });
                            }}
                            disabled={modalType === 'view'}
                        >
                            <option>Private Residence</option>
                            <option>Yacht / Onboard</option>
                            <option>Luxury Resort</option>
                            <option>Secret Beach</option>
                            <option>Other</option>
                        </select>
                    </div>

                    {(formData.locationType === 'Other' || modalType === 'view') && (
                        <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-bold text-muted uppercase">Location Details</label>
                            <input
                                type="text"
                                placeholder="Enter bespoke location details..."
                                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                disabled={modalType === 'view'}
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase">Special Requests & Customizations</label>
                        <textarea
                            placeholder="Floral arrangements, specific catering, security needs..."
                            className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none min-h-[80px]"
                            value={formData.specialRequests}
                            onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                            disabled={modalType === 'view'}
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-4">
                        <button onClick={handleCloseModal} className="btn-secondary">{modalType === 'view' ? 'Close Registry' : 'Discard'}</button>
                        {(modalType === 'add' || modalType === 'edit') && (
                            <button
                                onClick={handleSave}
                                className="btn-primary px-8"
                            >
                                {modalType === 'add' ? 'Submit Request' : 'Save Changes'}
                            </button>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ClientEvents;
