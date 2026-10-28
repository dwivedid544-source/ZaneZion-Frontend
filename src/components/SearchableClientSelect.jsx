import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

const SearchableClientSelect = ({
    clients = [],
    value,
    onChange,
    disabled = false,
    placeholder = "-- Type client name or click arrow --",
    required = false,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Format display string for a client
    const formatLabel = (c) => {
        if (!c) return '';
        return `${c.name} (${c.type})${c.email ? ` • ${c.email}` : ''}`;
    };

    // Synchronize searchTerm when value changes externally (e.g. modal open)
    useEffect(() => {
        if (value) {
            const matched = clients.find(c => String(c.id) === String(value));
            if (matched) {
                setSearchTerm(formatLabel(matched));
            } else {
                setSearchTerm(String(value));
            }
        } else {
            setSearchTerm('');
        }
    }, [value, clients]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                // If user typed something but didn't select, restore selected client's label
                if (value) {
                    const matched = clients.find(c => String(c.id) === String(value));
                    if (matched) setSearchTerm(formatLabel(matched));
                } else if (!searchTerm.trim()) {
                    setSearchTerm('');
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [value, clients, searchTerm]);

    // Filtered list based on search term
    const filteredClients = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        // If query is empty OR matches current selected client exactly, show all clients
        const selectedObj = clients.find(c => String(c.id) === String(value));
        const selectedLabel = selectedObj ? formatLabel(selectedObj).toLowerCase() : '';
        if (!q || q === selectedLabel) {
            return clients;
        }

        return clients.filter(c => {
            const nameMatch = c.name && c.name.toLowerCase().includes(q);
            const emailMatch = c.email && c.email.toLowerCase().includes(q);
            const typeMatch = c.type && c.type.toLowerCase().includes(q);
            const idMatch = c.id && String(c.id).includes(q);
            return nameMatch || emailMatch || typeMatch || idMatch;
        });
    }, [clients, searchTerm, value]);

    const handleSelect = (client) => {
        if (onChange) {
            onChange(client);
        }
        setSearchTerm(formatLabel(client));
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        if (onChange) {
            onChange(null);
        }
        setSearchTerm('');
        setIsOpen(false);
        if (inputRef.current) inputRef.current.focus();
    };

    const handleArrowClick = (e) => {
        e.stopPropagation();
        if (disabled) return;
        setIsOpen(prev => !prev);
        if (!isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setSearchTerm(val);
        // When user writes/types in the field, open dropdown to show matching clients
        if (val.trim().length > 0) {
            setIsOpen(true);
        } else {
            // When field is blank, do not show full dropdown unless down arrow is clicked
            setIsOpen(false);
        }
    };

    const handleInputFocus = (e) => {
        if (disabled) return;
        // Select existing text so typing immediately replaces with new search
        e.target.select();
        // If user already has typed search characters, show filtered results
        if (searchTerm.trim().length > 0) {
            const selectedObj = clients.find(c => String(c.id) === String(value));
            const selectedLabel = selectedObj ? formatLabel(selectedObj).toLowerCase() : '';
            // If they are actively searching (term doesn't just equal the selected label), open results
            if (searchTerm.trim().toLowerCase() !== selectedLabel) {
                setIsOpen(true);
            }
        }
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            <div className="relative flex items-center">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    disabled={disabled}
                    placeholder={placeholder}
                    required={required && !value}
                    className="w-full bg-background border border-border rounded-lg pl-4 pr-16 py-2.5 text-sm font-bold text-white placeholder-muted/50 focus:border-accent outline-none transition-colors"
                />

                <div className="absolute right-2 flex items-center gap-1 text-muted">
                    {/* Clear Button */}
                    {searchTerm && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            title="Clear selection"
                            className="p-1 hover:text-white rounded-md transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}

                    {/* Down Arrow Button: Clicking this toggles the full client list */}
                    <button
                        type="button"
                        onClick={handleArrowClick}
                        disabled={disabled}
                        title="Show all clients"
                        className="p-1.5 hover:text-white rounded-md transition-transform"
                    >
                        <ChevronDown
                            size={16}
                            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-accent' : ''}`}
                        />
                    </button>
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && !disabled && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#14141e] border border-white/10 rounded-xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar backdrop-blur-2xl divide-y divide-white/5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {filteredClients.length > 0 ? (
                        filteredClients.map((c) => {
                            const isSelected = String(c.id) === String(value);
                            return (
                                <div
                                    key={c.id}
                                    onClick={() => handleSelect(c)}
                                    className={`px-4 py-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                                        isSelected
                                            ? 'bg-accent/15 text-accent font-bold'
                                            : 'text-white hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex flex-col min-w-0 pr-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-xs truncate">{c.name}</span>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-muted uppercase tracking-wider shrink-0">
                                                {c.type}
                                            </span>
                                        </div>
                                        {c.email && (
                                            <span className="text-[10px] text-muted truncate mt-0.5">{c.email}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[9px] font-mono text-accent opacity-80 font-bold">
                                            ID: #{c.id}
                                        </span>
                                        {isSelected && <Check size={14} className="text-accent" />}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="px-4 py-6 text-center text-xs text-muted">
                            <p>No clients found matching <span className="text-white font-bold">"{searchTerm}"</span></p>
                            <button
                                type="button"
                                onClick={() => { setSearchTerm(''); setIsOpen(true); }}
                                className="text-[10px] text-accent mt-2 hover:underline font-bold"
                            >
                                Show all clients
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableClientSelect;
