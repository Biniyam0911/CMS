import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles, Search, Plus, Calendar, User, Phone, Check, X,
  Printer, Trash2, RefreshCw, Loader2, ArrowUpDown, FileText,
  DollarSign, Activity, ChevronRight, Filter, Download, Package,
  ShoppingCart, AlertTriangle, Layers
} from 'lucide-react';
import { api, logAudit } from '../../api/apiClient';

interface CosmeticsItem {
  id: number;
  code: string;
  description: string;
  purchaseUnitPrice: number;
  quantity: number;
  margin: number;
  sellingUnitPrice: number;
  totalPurchasePrice: number;
  totalSellingPrice: number;
  registrationDate: string;
  isActive: boolean;
}

interface CartItem {
  id: number; // Row sequence (1, 2, 3...)
  itemId: number;
  code: string;
  description: string;
  firstName: string;
  middleName: string;
  lastName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface SaleReceipt {
  saleId: number;
  invoiceNumber: string;
  totalAmount: number;
  clientName: string;
  mobile: string;
  isPlc: boolean;
  date: string;
  time: string;
  items: CartItem[];
}

export default function CosmeticsPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'register' | 'sales'>('stock');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toast Alerts
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  useEffect(() => {
    if (errorToast) {
      const timer = setTimeout(() => setErrorToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorToast]);

  // ==========================================
  // DATA STATE
  // ==========================================
  const [stockItems, setStockItems] = useState<CosmeticsItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockSearch, setStockSearch] = useState('');

  // Fetch Stock Items
  const loadStock = async () => {
    setLoadingStock(true);
    try {
      const res: any = await api.get('/cosmetics/stock');
      const list = Array.isArray(res) ? res : (res?.data || []);
      setStockItems(list);
    } catch (err: any) {
      console.error('Failed to load stock:', err);
      setErrorToast('Failed to load cosmetics stock items.');
    } finally {
      setLoadingStock(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, []);

  // Filtered Stock
  const filteredStock = useMemo(() => {
    if (!stockSearch.trim()) return stockItems;
    const q = stockSearch.toLowerCase();
    return stockItems.filter(item =>
      (item.code || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q)
    );
  }, [stockItems, stockSearch]);

  // ==========================================
  // TAB 2: COSMETICS ITEM REGISTRATION (ADD STOCK)
  // ==========================================
  const [itemCode, setItemCode] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [margin, setMargin] = useState<string>('1.56');
  const [savingItem, setSavingItem] = useState(false);

  // Auto-calculated fields for Registration
  const pPriceNum = parseFloat(purchaseUnitPrice) || 0;
  const qtyNum = parseFloat(quantity) || 0;
  const marginNum = parseFloat(margin) || 1.0;

  const sellingUnitPrice = Math.round(pPriceNum * marginNum * 100) / 100;
  const totalPurchasePrice = Math.round(pPriceNum * qtyNum * 100) / 100;
  const totalSellingPrice = Math.round(sellingUnitPrice * qtyNum * 100) / 100;

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCode.trim()) {
      setErrorToast('Please enter an Item Code (e.g., CS01, ECR07).');
      return;
    }
    if (!itemDescription.trim()) {
      setErrorToast('Please enter an Item Description.');
      return;
    }
    if (pPriceNum < 0 || qtyNum <= 0) {
      setErrorToast('Please enter valid Purchase Unit Price and Quantity.');
      return;
    }

    setSavingItem(true);
    try {
      const payload = {
        code: itemCode.trim().toUpperCase(),
        description: itemDescription.trim(),
        purchaseUnitPrice: pPriceNum,
        quantity: qtyNum,
        margin: marginNum,
        sellingUnitPrice: sellingUnitPrice,
        totalPurchasePrice: totalPurchasePrice,
        totalSellingPrice: totalSellingPrice
      };

      const res: any = await api.post('/cosmetics/items', payload);
      setSuccessToast(res?.message || res?.data?.message || `Item ${itemCode.toUpperCase()} registered successfully!`);

      // Reset form
      setItemCode('');
      setItemDescription('');
      setPurchaseUnitPrice('');
      setQuantity('');
      setMargin('1.56');

      // Refresh stock and switch to stock view
      await loadStock();
      setActiveTab('stock');
    } catch (err: any) {
      console.error('Failed to save item:', err);
      setErrorToast(err?.message || 'Failed to save cosmetics item.');
    } finally {
      setSavingItem(false);
    }
  };

  // ==========================================
  // TAB 3: CASH SALES
  // ==========================================
  const [saleMobile, setSaleMobile] = useState('');
  const [saleFirstName, setSaleFirstName] = useState('');
  const [saleMiddleName, setSaleMiddleName] = useState('');
  const [saleLastName, setSaleLastName] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');
  const [saleQty, setSaleQty] = useState('1');
  const [isPlc, setIsPlc] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedCartRowId, setSelectedCartRowId] = useState<number | null>(null);
  const [searchingClient, setSearchingClient] = useState(false);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);

  // Selected item object from dropdown
  const currentSelectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return stockItems.find(i => i.id === Number(selectedItemId)) || null;
  }, [stockItems, selectedItemId]);

  const saleQtyNum = parseFloat(saleQty) || 0;
  const currentItemSellingPrice = currentSelectedItem ? currentSelectedItem.sellingUnitPrice : 0;
  const lineTotalPrice = Math.round(currentItemSellingPrice * saleQtyNum * 100) / 100;

  // Search Client by Mobile
  const handleSearchClient = async () => {
    if (!saleMobile.trim()) {
      setErrorToast('Please enter a mobile number to search.');
      return;
    }

    setSearchingClient(true);
    try {
      const res: any = await api.get(`/cosmetics/client-lookup?mobile=${encodeURIComponent(saleMobile.trim())}`);
      const data = res?.data || res;
      if (data && (data.firstName || data.lastName)) {
        setSaleFirstName(data.firstName || '');
        setSaleMiddleName(data.middleName || '');
        setSaleLastName(data.lastName || '');
        setSuccessToast(`Client found: ${[data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')}`);
      } else {
        setErrorToast('No client found for this mobile number. You can type the name manually.');
      }
    } catch (err: any) {
      console.error('Client lookup error:', err);
      setErrorToast('Client lookup failed.');
    } finally {
      setSearchingClient(false);
    }
  };

  // Add Item to Cart
  const handleAddItemToCart = () => {
    if (!currentSelectedItem) {
      setErrorToast('Please select an item from the Item dropdown.');
      return;
    }
    if (saleQtyNum <= 0) {
      setErrorToast('Quantity must be greater than 0.');
      return;
    }
    if (saleQtyNum > currentSelectedItem.quantity) {
      setErrorToast(`Warning: Only ${currentSelectedItem.quantity} available in stock.`);
    }

    const newItem: CartItem = {
      id: cartItems.length + 1,
      itemId: currentSelectedItem.id,
      code: currentSelectedItem.code,
      description: currentSelectedItem.description,
      firstName: saleFirstName.trim(),
      middleName: saleMiddleName.trim(),
      lastName: saleLastName.trim(),
      quantity: saleQtyNum,
      unitPrice: currentSelectedItem.sellingUnitPrice,
      totalPrice: lineTotalPrice
    };

    setCartItems(prev => [...prev, newItem]);
    setSelectedCartRowId(newItem.id);

    // Reset item selector
    setSelectedItemId('');
    setSaleQty('1');
    setSuccessToast(`Added ${newItem.description} (${newItem.quantity}x)`);
  };

  // Remove Item from Cart
  const handleRemoveItemFromCart = () => {
    if (cartItems.length === 0) return;
    if (selectedCartRowId === null) {
      // Remove last item if none selected
      setCartItems(prev => prev.slice(0, prev.length - 1));
      return;
    }
    setCartItems(prev => {
      const filtered = prev.filter(item => item.id !== selectedCartRowId);
      // Re-index remaining rows
      return filtered.map((item, idx) => ({ ...item, id: idx + 1 }));
    });
    setSelectedCartRowId(null);
  };

  // Cart total sum
  const cartTotalSum = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [cartItems]);

  // Process Payment
  const handleProcessSale = async () => {
    if (cartItems.length === 0) {
      setErrorToast('Your cart is empty. Please add at least one item.');
      return;
    }

    setPaying(true);
    try {
      const payload = {
        mobileNo: saleMobile.trim() || null,
        firstName: saleFirstName.trim() || null,
        middleName: saleMiddleName.trim() || null,
        lastName: saleLastName.trim() || null,
        isPlc: isPlc,
        totalAmount: cartTotalSum,
        items: cartItems.map(item => ({
          itemId: item.itemId,
          itemCode: item.code,
          itemDescription: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        }))
      };

      const res: any = await api.post('/cosmetics/sales', payload);
      const invNo = res?.data?.invoiceNumber || res?.invoiceNumber || 'CS-PAID';

      const receiptData: SaleReceipt = {
        saleId: res?.data?.saleId || 0,
        invoiceNumber: invNo,
        totalAmount: cartTotalSum,
        clientName: [saleFirstName, saleMiddleName, saleLastName].filter(Boolean).join(' ') || 'Walk-in Client',
        mobile: saleMobile.trim() || '-',
        isPlc: isPlc,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        items: [...cartItems]
      };

      setReceipt(receiptData);
      setSuccessToast(`Payment successful! Invoice: ${invNo}`);

      await logAudit({
        tableName: 'CosmeticsSales',
        recordId: invNo,
        operation: 'COSMETICS_SALE',
        oldValues: null,
        newValues: payload
      });

      // Clear cart and form
      setCartItems([]);
      setSelectedCartRowId(null);
      setSaleMobile('');
      setSaleFirstName('');
      setSaleMiddleName('');
      setSaleLastName('');
      setIsPlc(false);

      // Refresh stock balance
      loadStock();
    } catch (err: any) {
      console.error('Failed to process sale:', err);
      setErrorToast(err?.message || 'Failed to process payment.');
    } finally {
      setPaying(false);
    }
  };

  // Print Receipt
  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: isMobile ? '12px' : '20px' }}>
      
      {/* Toast Alerts */}
      {successToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          background: '#10b981',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 700,
          fontSize: '0.88rem'
        }}>
          <Check size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          background: '#ef4444',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 700,
          fontSize: '0.88rem'
        }}>
          <X size={18} />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Main Window Box matching the client's application style */}
      <div style={{
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #d1d5db',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden'
      }}>

        {/* Tab Headers bar: Stock x | Cosmetics Item Registration x | Cash Sales x */}
        <div style={{
          background: '#f3f4f6',
          borderBottom: '1px solid #d1d5db',
          padding: '8px 14px 0 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          overflowX: 'auto'
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            
            {/* Tab 1: Stock */}
            <div
              onClick={() => setActiveTab('stock')}
              style={{
                background: activeTab === 'stock' ? '#ffffff' : '#e5e7eb',
                border: '1px solid #d1d5db',
                borderBottom: activeTab === 'stock' ? '1px solid #ffffff' : '1px solid #d1d5db',
                borderRadius: '6px 6px 0 0',
                padding: '7px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: activeTab === 'stock' ? '#111827' : '#4b5563',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-1px'
              }}
            >
              <span>Stock</span>
              <span
                onClick={(e) => { e.stopPropagation(); setActiveTab('register'); }}
                title="Switch to Item Registration"
                style={{ fontSize: '0.75rem', color: '#9ca3af', cursor: 'pointer', padding: '1px 3px' }}
              >
                ×
              </span>
            </div>

            {/* Tab 2: Cosmetics Item Registration */}
            <div
              onClick={() => setActiveTab('register')}
              style={{
                background: activeTab === 'register' ? '#ffffff' : '#e5e7eb',
                border: '1px solid #d1d5db',
                borderBottom: activeTab === 'register' ? '1px solid #ffffff' : '1px solid #d1d5db',
                borderRadius: '6px 6px 0 0',
                padding: '7px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: activeTab === 'register' ? '#111827' : '#4b5563',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-1px'
              }}
            >
              <span>Cosmetics Item Registration</span>
              <span
                onClick={(e) => { e.stopPropagation(); setActiveTab('sales'); }}
                title="Switch to Cash Sales"
                style={{ fontSize: '0.75rem', color: '#9ca3af', cursor: 'pointer', padding: '1px 3px' }}
              >
                ×
              </span>
            </div>

            {/* Tab 3: Cash Sales */}
            <div
              onClick={() => setActiveTab('sales')}
              style={{
                background: activeTab === 'sales' ? '#ffffff' : '#e5e7eb',
                border: '1px solid #d1d5db',
                borderBottom: activeTab === 'sales' ? '1px solid #ffffff' : '1px solid #d1d5db',
                borderRadius: '6px 6px 0 0',
                padding: '7px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: activeTab === 'sales' ? '#111827' : '#4b5563',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-1px'
              }}
            >
              <span>Cash Sales</span>
              <span
                onClick={(e) => { e.stopPropagation(); setActiveTab('stock'); }}
                title="Switch to Stock"
                style={{ fontSize: '0.75rem', color: '#9ca3af', cursor: 'pointer', padding: '1px 3px' }}
              >
                ×
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '6px' }}>
            <button
              onClick={loadStock}
              title="Refresh Data"
              style={{
                background: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.75rem',
                color: '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={12} className={loadingStock ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: STOCK VIEW (Image 3)                                              */}
        {/* ========================================================================= */}
        {activeTab === 'stock' && (
          <div style={{ padding: '16px' }}>
            
            {/* Top Table Control Bar matching screenshot */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              padding: '6px 12px',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb'
            }}>
              <span style={{ fontSize: '0.82rem', color: '#9ca3af', fontStyle: 'italic' }}>
                Drag a column header here to group by that column
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search Code or Description..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    style={{
                      padding: '5px 30px 5px 10px',
                      fontSize: '0.82rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      width: '240px',
                      outline: 'none'
                    }}
                  />
                  <Search size={14} style={{ position: 'absolute', right: '9px', top: '8px', color: '#9ca3af' }} />
                </div>

                <button
                  onClick={() => setActiveTab('register')}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={14} /> Add Stock
                </button>
              </div>
            </div>

            {/* Stock Data Grid matching screenshot table layout */}
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                    <th style={{ width: '40px', padding: '10px 8px', textAlign: 'center' }}></th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Code</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Quantity</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Registration Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStock ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                        <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                        <div>Loading cosmetics inventory...</div>
                      </td>
                    </tr>
                  ) : filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        No cosmetics stock items found. Click "Add Stock" to register new items.
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((item, idx) => (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#fafafa'}
                      >
                        <td style={{ padding: '9px 8px', textAlign: 'center', color: '#94a3b8' }}>
                          <ChevronRight size={14} />
                        </td>
                        <td style={{ padding: '9px 14px', fontWeight: 700, color: '#0369a1', fontFamily: 'monospace' }}>
                          {item.code}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#1e293b' }}>
                          {item.description}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {Number(item.sellingUnitPrice).toFixed(2)}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600 }}>
                          <span style={{
                            color: item.quantity <= 5 ? '#dc2626' : '#059669',
                            background: item.quantity <= 5 ? '#fef2f2' : '#f0fdf4',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                          }}>
                            {Number(item.quantity).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                          {item.registrationDate ? String(item.registrationDate).split('T')[0] : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Stock Summary Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              padding: '10px 14px',
              background: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.82rem',
              color: '#475569'
            }}>
              <div>Total Unique Items: <strong>{filteredStock.length}</strong></div>
              <div>
                Total Units on Hand:{' '}
                <strong>
                  {filteredStock.reduce((acc, i) => acc + Number(i.quantity), 0).toFixed(2)}
                </strong>
              </div>
              <div>
                Total Inventory Valuation:{' '}
                <strong style={{ color: '#0284c7' }}>
                  Br {filteredStock.reduce((acc, i) => acc + (Number(i.sellingUnitPrice) * Number(i.quantity)), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: COSMETICS ITEM REGISTRATION (Image 1)                              */}
        {/* ========================================================================= */}
        {activeTab === 'register' && (
          <form onSubmit={handleSaveItem} style={{ padding: '24px 28px' }}>
            
            {/* 1. Item Code */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Item Code
              </label>
              <input
                type="text"
                placeholder="Item Code starts with CS and 2 digit number (e.g. CS01)"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '5px',
                  outline: 'none',
                  background: '#ffffff'
                }}
              />
            </div>

            {/* 2. Item Description */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Item Description
              </label>
              <input
                type="text"
                placeholder="Item Description..."
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '5px',
                  outline: 'none',
                  background: '#ffffff'
                }}
              />
            </div>

            {/* 3. Purchase Unit Price */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Purchase Unit Price
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Invoice unit price amount..."
                value={purchaseUnitPrice}
                onChange={(e) => setPurchaseUnitPrice(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '5px',
                  outline: 'none',
                  background: '#ffffff'
                }}
              />
            </div>

            {/* 4. Quantity */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Quantity
              </label>
              <input
                type="number"
                step="1"
                placeholder="Total purchased Quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '5px',
                  outline: 'none',
                  background: '#ffffff'
                }}
              />
            </div>

            {/* 5. Margin */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Margin
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Profit Margin (e.g. 1.56 means 56%)"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '5px',
                  outline: 'none',
                  background: '#ffffff'
                }}
              />
            </div>

            {/* 6. Selling Unit Price (Auto Calculated) */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Selling Unit Price
              </label>
              <input
                type="text"
                readOnly
                placeholder="Selling unit price (Automatically Calculated)"
                value={sellingUnitPrice > 0 ? sellingUnitPrice.toFixed(2) : ''}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '5px',
                  background: '#f9fafb',
                  color: '#111827',
                  fontWeight: 600
                }}
              />
            </div>

            {/* 7. Total Purchase Price (Auto Calculated) */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Total Purchase Price
              </label>
              <input
                type="text"
                readOnly
                placeholder="Total Invoice Amount (Automatically Calculated)"
                value={totalPurchasePrice > 0 ? totalPurchasePrice.toFixed(2) : ''}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '5px',
                  background: '#f9fafb',
                  color: '#111827',
                  fontWeight: 600
                }}
              />
            </div>

            {/* 8. Total Selling Price (Auto Calculated) */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Total Selling Price
              </label>
              <input
                type="text"
                readOnly
                placeholder="Total Revenue (Automatically Calculated)"
                value={totalSellingPrice > 0 ? totalSellingPrice.toFixed(2) : ''}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '5px',
                  background: '#f9fafb',
                  color: '#111827',
                  fontWeight: 600
                }}
              />
            </div>

            {/* Save Button (Bottom Right) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={savingItem}
                style={{
                  padding: '9px 40px',
                  background: '#ffffff',
                  color: '#111827',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: savingItem ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  minWidth: '130px',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
              >
                {savingItem ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CASH SALES (Image 2)                                               */}
        {/* ========================================================================= */}
        {activeTab === 'sales' && (
          <div style={{ padding: '20px 24px' }}>
            
            {/* Top Row: Mobile No + Search button */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '20px',
              alignItems: 'end',
              marginBottom: '16px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Mobile No
                </label>
                <input
                  type="text"
                  placeholder="Enter Mobile No..."
                  value={saleMobile}
                  onChange={(e) => setSaleMobile(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchClient(); } }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleSearchClient}
                  disabled={searchingClient}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    background: '#ffffff',
                    color: '#111827',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: searchingClient ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  {searchingClient ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {/* Two-Column Form Area */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '20px',
              marginBottom: '16px'
            }}>
              
              {/* Left Column */}
              <div>
                {/* Firstname */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    Firstname
                  </label>
                  <input
                    type="text"
                    placeholder="Firstname..."
                    value={saleFirstName}
                    onChange={(e) => setSaleFirstName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* LastName */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    LastName
                  </label>
                  <input
                    type="text"
                    placeholder="Lastname..."
                    value={saleLastName}
                    onChange={(e) => setSaleLastName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Quantity */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Quantity..."
                    value={saleQty}
                    onChange={(e) => setSaleQty(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Right Column */}
              <div>
                {/* Middlename */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    Middlename
                  </label>
                  <input
                    type="text"
                    placeholder="Middlename..."
                    value={saleMiddleName}
                    onChange={(e) => setSaleMiddleName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Item Dropdown */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    Item
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value ? Number(e.target.value) : '')}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      outline: 'none',
                      background: '#ffffff'
                    }}
                  >
                    <option value="">Select Item...</option>
                    {stockItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.description} (Br {Number(item.sellingUnitPrice).toFixed(2)} | Avail: {item.quantity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Total Price (Auto Calculated) */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    Total Price
                  </label>
                  <input
                    type="text"
                    readOnly
                    placeholder="Total Price will be Automatically Calculated."
                    value={lineTotalPrice > 0 ? `Br ${lineTotalPrice.toFixed(2)}` : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      background: '#f9fafb',
                      color: '#111827',
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Checkbox & Action Buttons Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              {/* PLC Checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={isPlc}
                  onChange={(e) => setIsPlc(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>PLC</span>
              </label>

              {/* Add Item & Remove Item Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleAddItemToCart}
                  style={{
                    padding: '8px 24px',
                    background: '#ffffff',
                    color: '#111827',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    minWidth: '120px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  Add Item
                </button>

                <button
                  type="button"
                  onClick={handleRemoveItemFromCart}
                  disabled={cartItems.length === 0}
                  style={{
                    padding: '8px 24px',
                    background: '#ffffff',
                    color: '#111827',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: cartItems.length === 0 ? 'not-allowed' : 'pointer',
                    minWidth: '120px',
                    opacity: cartItems.length === 0 ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  Remove Item
                </button>
              </div>
            </div>

            {/* Cart Table Header Subtitle */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              padding: '6px 10px',
              background: '#f9fafb',
              borderRadius: '4px'
            }}>
              <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic' }}>
                Drag a column header here to group by that column
              </span>
              <Search size={14} style={{ color: '#9ca3af' }} />
            </div>

            {/* Cash Sales Cart Data Grid */}
            <div style={{
              overflowX: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              minHeight: '160px',
              marginBottom: '16px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                    <th style={{ width: '50px', padding: '9px 12px', textAlign: 'center' }}>ID</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left' }}>Firstname</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left' }}>Middlename</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left' }}>Lastname</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left' }}>Item</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right' }}>Quantity</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right' }}>Total Price</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#9ca3af' }}>
                        No items added to sale. Select an item, enter quantity, and click "Add Item".
                      </td>
                    </tr>
                  ) : (
                    cartItems.map((cItem) => (
                      <tr
                        key={cItem.id}
                        onClick={() => setSelectedCartRowId(cItem.id)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: selectedCartRowId === cItem.id ? '#e0f2fe' : '#ffffff',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                          {cItem.id}
                        </td>
                        <td style={{ padding: '8px 12px' }}>{cItem.firstName || '-'}</td>
                        <td style={{ padding: '8px 12px' }}>{cItem.middleName || '-'}</td>
                        <td style={{ padding: '8px 12px' }}>{cItem.lastName || '-'}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0369a1' }}>
                          {cItem.code} - {cItem.description}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{cItem.quantity}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{Number(cItem.unitPrice).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          Br {Number(cItem.totalPrice).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Row: SUM=0 on left, Pay on right */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '6px'
            }}>
              {/* SUM Box */}
              <div style={{
                border: '1px solid #d1d5db',
                padding: '8px 24px',
                borderRadius: '4px',
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#111827',
                background: '#ffffff',
                minWidth: '140px',
                textAlign: 'center'
              }}>
                SUM={cartTotalSum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>

              {/* Pay Button */}
              <button
                type="button"
                onClick={handleProcessSale}
                disabled={paying || cartItems.length === 0}
                style={{
                  padding: '9px 48px',
                  background: '#ffffff',
                  color: '#111827',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: paying || cartItems.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  minWidth: '130px',
                  textAlign: 'center',
                  opacity: cartItems.length === 0 ? 0.6 : 1
                }}
                onMouseEnter={(e) => { if (cartItems.length > 0) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
              >
                {paying ? 'Processing...' : 'Pay'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* INVOICE / RECEIPT MODAL                                                  */}
      {/* ========================================================================= */}
      {receipt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              background: '#f8fafc',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={20} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Cash Sale Receipt
                </h3>
              </div>
              <button
                onClick={() => setReceipt(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Receipt Body */}
            <div style={{ padding: '20px', fontSize: '0.85rem', color: '#334155' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: '14px', marginBottom: '14px' }}>
                <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  Huderma Clinic
                </h2>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Cosmetics & Aesthetics Division</div>
                <div style={{ marginTop: '8px', fontSize: '0.9rem', fontWeight: 700, color: '#0284c7' }}>
                  Invoice: {receipt.invoiceNumber}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px', fontSize: '0.8rem' }}>
                <div>Client: <strong>{receipt.clientName}</strong></div>
                <div>Mobile: <strong>{receipt.mobile}</strong></div>
                <div>Date: <strong>{receipt.date} {receipt.time}</strong></div>
                <div>Category: <strong>{receipt.isPlc ? 'PLC' : 'Standard Cash'}</strong></div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
                    <th style={{ textAlign: 'left', padding: '6px 0' }}>Item</th>
                    <th style={{ textAlign: 'center', padding: '6px 0' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '6px 0' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '6px 0' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px dotted #f1f5f9' }}>
                      <td style={{ padding: '6px 0' }}>{it.description}</td>
                      <td style={{ textAlign: 'center', padding: '6px 0' }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{Number(it.unitPrice).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: 600 }}>{Number(it.totalPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '2px solid #0f172a',
                paddingTop: '10px',
                fontSize: '1.05rem',
                fontWeight: 800,
                color: '#0f172a'
              }}>
                <span>Total Paid:</span>
                <span>Br {receipt.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              background: '#f8fafc',
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={handlePrintReceipt}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={16} /> Print Receipt
              </button>
              <button
                onClick={() => setReceipt(null)}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
