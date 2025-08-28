import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, Cog, IndianRupee, Loader2, ShieldCheck, WashingMachine, Zap, Users, Settings } from "lucide-react"; // Recharts imports

// =========================
// HI5 LAUNDROMAT — SINGLE FILE PROTOTYPE (ENGLISH‑ONLY)
// Panels: Customer, Staff, Owner, Admin Panel, Membership
// Pricing: Normal ₹350 (per 6kg load), Express ₹450 (per 6kg load, finish within 1 hour)
// Blankets handled separately (not included in base price)
// No ironing. No delivery. Wash-Dry-Fold only.
// Dexter premium machines from USA highlighted.
// =========================

// --- Constants & Types ---
const BASE_LOAD_WEIGHT_KG = 6;
const LOAD_PRICES = { normal: 350, express: 450 } as const;
const SERVICE_LABEL = {
  normal: "Normal Load — ₹350 per load",
  express: "Express Load — ₹450 per load (1 hour)",
} as const;

const MEMBERSHIP_DISCOUNTS_INITIAL = { // Renamed to initial
  none: 0,
  silver: 0.05, // 5% off
  gold: 0.10,   // 10% off
  platinum: 0.15 // 15% off
} as const;

const MEMBERSHIP_LABELS = {
  none: "No Membership",
  silver: "Silver Plan – 5% OFF",
  gold: "Gold Plan – 10% OFF",
  platinum: "Platinum Plan – 15% OFF"
} as const;

type MembershipType = keyof typeof MEMBERSHIP_DISCOUNTS_INITIAL;


const UI = {
  title: "Hi5 Laundromat",
  subtitle: "Wash • Dry • Fold — Premium Dexter Machines",
  noteBlanket: "Note: Blankets are handled separately at the counter.",
  expressSLA: "Express deadline (1 hour)",
};

const ORDER_STAGES = ["received", "wash", "dry", "fold", "ready", "picked_up"] as const; // Added "picked_up" stage
type OrderStage = typeof ORDER_STAGES[number];

type PaymentMethod = "cash" | "online" | "pending" | "membership_covered"; // New type for payment method, including 'pending' and 'membership_covered'

type Order = {
  token: string;
  name: string;
  phone: string;
  weight: number; // kg
  loads: number; // calculated 6kg loads
  blankets: boolean;
  type: "normal" | "express";
  price: number;
  createdAt: number; // epoch ms
  dueAt?: number; // for express
  stage: OrderStage;
  completedAt?: number;
  staffId?: string;
  paymentMethod: PaymentMethod; // Added payment method
  membership: MembershipType; // Added membership type
};

// --- Utils ---
function inr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
// Removed genToken() as tokens will be manually entered
// function genToken() { return `HI5-${Math.floor(1000 + Math.random() * 9000)}`; }
function minutes(ms: number) { return Math.floor(ms / 60000); }
function nextStage(s: OrderStage): OrderStage {
  const i = ORDER_STAGES.indexOf(s);
  // If current stage is "ready", next stage is "picked_up"
  if (s === "ready") return "picked_up";
  return ORDER_STAGES[Math.min(i + 1, ORDER_STAGES.length - 1)];
}
function stageLabel(s: OrderStage) {
  switch (s) {
    case "received": return "Received";
    case "wash":
    case "dry":
    case "fold": return "In Progress"; // Simplified to "In Progress"
    case "ready": return "Ready for pickup";
    case "picked_up": return "Picked Up"; // Label for new stage
  }
}

// Helper to calculate loads and price, now considering membership discount
function calculateOrderDetails(weight: number, type: "normal" | "express", membership: MembershipType = 'none', currentDiscounts: Record<MembershipType, number>) {
  const loads = Math.ceil(weight / BASE_LOAD_WEIGHT_KG);
  let price = loads * LOAD_PRICES[type];

  // Apply discount only for Normal Loads and if membership is not 'none'
  if (type === "normal" && membership !== "none") {
    price = price * (1 - currentDiscounts[membership]);
  }
  return { loads, price: Math.round(price) }; // Round price to nearest whole number
}

// Function to check if a given timestamp (ms) falls on a holiday (YYYY-MM-DD format)
function isHoliday(timestamp: number, holidays: string[]): boolean {
  const date = new Date(timestamp);
  const dateString = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
  return holidays.includes(dateString);
}


// --- Demo Data ---
// Reduced demo data for conciseness
const demoOrders: Order[] = [
  { ...calculateOrderDetails(6, "normal", "silver", MEMBERSHIP_DISCOUNTS_INITIAL), token: "HI5-1432", name: "Ayesha", phone: "9000000001", weight: 6, blankets: false, type: "normal", createdAt: Date.now() - 45*60000, stage: "dry", staffId: "STF-01", paymentMethod: "cash", membership: "silver" },
  { ...calculateOrderDetails(12, "express", "none", MEMBERSHIP_DISCOUNTS_INITIAL), token: "HI5-5279", name: "Ravi", phone: "9000000002", weight: 12, blankets: true, type: "express", createdAt: Date.now() - 30*60000, dueAt: Date.now() + 30*60000, stage: "wash", staffId: "STF-02", paymentMethod: "online", membership: "none" },
  { ...calculateOrderDetails(5.4, "normal", "gold", MEMBERSHIP_DISCOUNTS_INITIAL), token: "HI5-8890", name: "Neha", phone: "9000000003", weight: 5.4, blankets: false, type: "normal", createdAt: Date.now() - 120*60000, stage: "fold", staffId: "STF-01", paymentMethod: "cash", membership: "gold" },
  { ...calculateOrderDetails(7, "normal", "silver", MEMBERSHIP_DISCOUNTS_INITIAL), token: "HI5-1111", name: "Ayesha", phone: "9000000001", weight: 7, blankets: false, type: "normal", createdAt: Date.now() - 10*60000, stage: "wash", staffId: "STF-01", paymentMethod: "online", membership: "silver" },
  { ...calculateOrderDetails(8, "express", "none", MEMBERSHIP_DISCOUNTS_INITIAL), token: "HI5-2222", name: "Ravi", phone: "9000000002", weight: 8, blankets: false, type: "express", createdAt: Date.now() - 5*60000, dueAt: Date.now() + 55*60000, stage: "received", staffId: "STF-02", paymentMethod: "cash", membership: "none" },
  { ...calculateOrderDetails(6, "normal", "platinum", MEMBERSHIP_DISCOUNTS_INITIAL), token: "HI5-3333", name: "Priya", phone: "9000000004", weight: 6, blankets: false, type: "normal", createdAt: Date.now() - 15*60000 - 30000, stage: "received", staffId: "STF-01", paymentMethod: "pending", membership: "platinum" }, // Changed to pending for demo
  { ...calculateOrderDetails(10, "normal", "none", MEMBERSHIP_DISCOUNTS_INITIAL), token: "HI5-9999", name: "PickedUp", phone: "9999999999", weight: 10, blankets: false, type: "normal", createdAt: Date.now() - 90*60000, stage: "picked_up", completedAt: Date.now() - 50*60000, paymentMethod: "cash", staffId: "STF-01", membership: "none" }, // Demo picked up order

  // NEW DEMO MEMBERSHIP ORDERS FOR MEMBERSHIP PANEL (kept for membership panel demo)
  { ...calculateOrderDetails(6, "normal", "silver", MEMBERSHIP_DISCOUNTS_INITIAL), token: "HI5-M001", name: "MemberA", phone: "9876543211", weight: 6, blankets: false, type: "normal", createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000, stage: "ready", paymentMethod: "membership_covered", membership: "silver" },
  { ...calculateOrderDetails(12, "normal", "gold", MEMBERSHIP_DISCOUNTS_INITIAL), token: "HI5-M002", name: "MemberB", phone: "9876543212", weight: 12, blankets: false, type: "normal", createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000, stage: "wash", staffId: "STF-01", paymentMethod: "membership_covered", membership: "gold" },
  { ...calculateOrderDetails(18, "normal", "platinum", MEMBERSHIP_DISCOUNTS_INITIAL), token: "HI5-M003", name: "MemberC", phone: "9000000003", weight: 18, blankets: false, type: "normal", createdAt: Date.now() - 0.5 * 60 * 60 * 1000, stage: "received", staffId: "STF-02", paymentMethod: "membership_covered", membership: "platinum" },
];

const demoStaff = [
  { id: "STF-01", name: "Arjun" },
  { id: "STF-02", name: "Priya" },
];

// =========================
// MAIN COMPONENT
// =========================
export default function Hi5LaundromatApp() {
  const [panel, setPanel] = useState<"customer" | "staff" | "owner" | "admin" | "membership">("customer"); // Added 'membership' to panel type
  const [orders, setOrders] = useState<Order[]>(demoOrders);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "ready" | "in_progress">("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [holidays, setHolidays] = useState<string[]>([]); // State to store holidays (YYYY-MM-DD)
  const [newHolidayDate, setNewHolidayDate] = useState<string>(""); // State for new holiday input
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'all'>('all'); // State for staff filter
  const [currentMembershipDiscounts, setCurrentMembershipDiscounts] = useState<Record<MembershipType, number>>(MEMBERSHIP_DISCOUNTS_INITIAL); // State for editable discounts

  // KPI calculations (for Owner/Admin)
  const kpi = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const startOfDay = today.getTime();

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();

    const todayOrders = orders.filter(o => o.createdAt >= startOfDay);
    const monthlyOrders = orders.filter(o => o.createdAt >= startOfMonth);

    const revenue = todayOrders.reduce((s, o) => s + o.price, 0);
    const normalCount = todayOrders.filter(o => o.type === "normal").length;
    const expressCount = todayOrders.filter(o => o.type === "express").length;
    const completed = todayOrders.filter(o => o.stage === "ready");
    const onTime = completed.filter(o => !o.dueAt || (o.completedAt && o.completedAt <= o.dueAt)).length;
    const onTimeRate = completed.length ? Math.round((onTime/completed.length)*100) : 100;
    const avgTatMin = completed.length ? Math.round(completed.reduce((s,o) => s + minutes((o.completedAt||Date.now()) - o.createdAt), 0)/completed.length) : 60;
    const staffLoad = Object.fromEntries(demoStaff.map(s => [s.id, todayOrders.filter(o => o.staffId === s.id).length]));

    // Calculate monthly customer visits and total spend
    const monthlyCustomerVisits: { name: string; phone: string; visits: number; totalSpend: number }[] = [];
    const customerVisitMap = new Map<string, { name: string; phone: string; visits: number; totalSpend: number }>();

    // Only include a few recent monthly orders for demo purposes
    monthlyOrders.slice(0, 3).forEach(order => { // Limiting to 3 for conciseness
      if (customerVisitMap.has(order.phone)) {
        const existing = customerVisitMap.get(order.phone)!;
        existing.visits++;
        existing.totalSpend += order.price;
      } else {
        customerVisitMap.set(order.phone, { name: order.name, phone: order.phone, visits: 1, totalSpend: order.price });
      }
    });

    // Calculate monthly total loads and revenue
    const monthlyTotalLoads = monthlyOrders.reduce((sum, order) => sum + order.loads, 0);
    const monthlyTotalRevenue = monthlyOrders.reduce((sum, order) => sum + order.price, 0);

    // Calculate today's total loads and wash count
    const todayTotalLoads = todayOrders.reduce((sum, order) => sum + order.loads, 0);
    const todayWashCount = todayOrders.filter(o => o.stage === "wash").length;

    // Calculate today's payment method counts
    const todayCashPayments = todayOrders.filter(o => o.paymentMethod === "cash").length;
    const todayOnlinePayments = todayOrders.filter(o => o.paymentMethod === "online").length;
    const todayPendingPayments = todayOrders.filter(o => o.paymentMethod === "pending").length; // New KPI for pending payments
    const todayMembershipCoveredOrders = todayOrders.filter(o => o.paymentMethod === "membership_covered").length; // New KPI for membership covered orders

    // Calculate total loads by membership type for the Membership panel
    const memberLoadsByTier: { [key in MembershipType]?: number } = {
      silver: 0,
      gold: 0,
      platinum: 0
    };
    const totalMemberLoads = orders.filter(o => o.membership !== 'none' && o.type === 'normal').reduce((sum, order) => {
      if (order.membership !== 'none') {
        memberLoadsByTier[order.membership] = (memberLoadsByTier[order.membership] || 0) + order.loads;
      }
      return sum + order.loads;
    }, 0);

    // Calculate today's loads by membership for the Membership panel
    const todayMembershipLoads = todayOrders.filter(o => o.paymentMethod === "membership_covered").reduce((sum, order) => sum + order.loads, 0);

    // Get a list of all membership-covered orders for the Membership panel
    const allMembershipOrders = orders.filter(o => o.paymentMethod === "membership_covered");


    // Sort by visits in descending order
    Array.from(customerVisitMap.values()).sort((a, b) => b.visits - a.visits).forEach(entry => {
      monthlyCustomerVisits.push(entry);
    });


    return { revenue, todayCount: todayOrders.length, normalCount, expressCount, onTimeRate, avgTatMin, staffLoad, monthlyCustomerVisits, monthlyTotalLoads, monthlyTotalRevenue, todayTotalLoads, todayWashCount, todayCashPayments, todayOnlinePayments, todayPendingPayments, todayMembershipCoveredOrders, totalMemberLoads, memberLoadsByTier, todayMembershipLoads, allMembershipOrders };
  }, [orders]);

  useEffect(() => {
    const id = setInterval(() => { setOrders(o => [...o]); }, 1000); // Refresh every second for countdown
    return () => clearInterval(id);
  }, []);

  // Filtered orders for Staff Panel
  const filteredStaffOrders = useMemo(() => {
    let filtered = orders;

    // Apply search query
    if (query) {
      filtered = filtered.filter(o =>
        o.token.toLowerCase().includes(query.toLowerCase()) ||
        o.phone.includes(query) ||
        o.name.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus === "ready") {
      filtered = filtered.filter(o => o.stage === "ready");
    } else if (filterStatus === "in_progress") {
      filtered = filtered.filter(o => o.stage === "wash" || o.stage === "dry" || o.stage === "fold");
    }

    // Apply date filter
    if (filterDate) {
      const selectedDate = new Date(filterDate);
      filtered = filtered.filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate.getFullYear() === selectedDate.getFullYear() &&
               orderDate.getMonth() === selectedDate.getMonth() &&
               orderDate.getDate() === selectedDate.getDate();
      });
    }

    // Apply staff filter for staff panel
    if (panel === "staff" && selectedStaffId !== 'all') {
      filtered = filtered.filter(o => o.staffId === selectedStaffId);
    }

    // IMPORTANT: Exclude 'membership_covered' orders from Staff Dashboard
    // This filter is applied only when the panel is 'staff'
    if (panel === "staff") {
      filtered = filtered.filter(o => o.paymentMethod !== 'membership_covered'); // Filter out all membership orders
    }


    return filtered;
  }, [orders, query, filterStatus, filterDate, selectedStaffId, panel]);

  const handleAddHoliday = () => {
    if (newHolidayDate && !holidays.includes(newHolidayDate)) {
      setHolidays([...holidays, newHolidayDate].sort());
      setNewHolidayDate("");
    }
  };

  const handleRemoveHoliday = (dateToRemove: string) => {
    setHolidays(holidays.filter(h => h !== dateToRemove));
  };


  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-neutral-50 to-neutral-100 text-neutral-900">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WashingMachine className="w-7 h-7" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{UI.title}</h1>
              <p className="text-xs text-neutral-500">{UI.subtitle}</p>
            </div>
            <Badge variant="secondary" className="ml-2">Dexter</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <ShieldCheck className="w-4 h-4" /> SLA: 1h Express
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-6">
        <Tabs value={panel} onValueChange={(v)=>setPanel(v as "customer" | "staff" | "owner" | "admin" | "membership")}>
          <TabsList className="grid grid-cols-5 w-full"> {/* Adjusted grid-cols to 5 for new tab */}
            <TabsTrigger value="customer">Customer</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="owner">Owner</TabsTrigger>
            <TabsTrigger value="admin">Admin Panel</TabsTrigger>
            <TabsTrigger value="membership">Membership</TabsTrigger> {/* New Membership Tab */}
          </TabsList>

          {/* CUSTOMER PANEL */}
          <TabsContent value="customer" className="grid md:grid-cols-2 gap-6">
            <OrderForm onCreate={(o)=> setOrders([o, ...orders])} holidays={holidays} currentMembershipDiscounts={currentMembershipDiscounts} /> {/* Pass currentMembershipDiscounts */}
          </TabsContent>

          {/* STAFF PANEL */}
          <TabsContent value="staff" className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Cog className="w-5 h-5" /> Staff Dashboard</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"> {/* Adjusted grid for staff selector */}
                  <Input placeholder="Search by token, name, or phone" value={query} onChange={(e)=>setQuery(e.target.value)} />
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "ready" | "in_progress")}>
                    <SelectTrigger><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="ready">Ready for Pickup</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                  <div className="grid gap-1">
                    <Label htmlFor="staff-filter">Filter by Staff</Label>
                    <Select value={selectedStaffId} onValueChange={(v) => setSelectedStaffId(v)}>
                      <SelectTrigger id="staff-filter"><SelectValue placeholder="All Staff" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Staff</SelectItem>
                        {demoStaff.map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <OrderTable
                  orders={filteredStaffOrders} // Use filtered orders here
                  staffMode
                  onAdvance={(token)=>{
                    setOrders(prev => prev.map(o => {
                      if (o.token !== token) return o;
                      // If the order is ready, mark it as picked_up; otherwise, advance to the next stage
                      if (o.stage === "ready") {
                        return { ...o, stage: "picked_up", completedAt: Date.now() };
                      }
                      const newStage = nextStage(o.stage);
                      const completedAt = newStage === "picked_up" ? Date.now() : o.completedAt; // Only set completedAt if reaching picked_up
                      return { ...o, stage: newStage, completedAt };
                    }));
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* OWNER PANEL (Analytics‑first, read‑only ops) */}
          <TabsContent value="owner" className="grid md:grid-cols-3 gap-6">
            {/* Today's Key Metrics */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><IndianRupee className="w-5 h-5" /> Today's Performance</CardTitle>
                <CardDescription>A quick look at today's operations.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-5 gap-4">
                <KpiTile icon={<Loader2 className="w-4 h-4" />} label="Total Orders (today)" value={String(kpi.todayCount)} />
                <KpiTile icon={<WashingMachine className="w-4 h-4" />} label="Normal" value={String(kpi.normalCount)} />
                <KpiTile icon={<Zap className="w-4 h-4" />} label="Express" value={String(kpi.expressCount)} />
                {/* New KPI Tiles for Today's Loads and Wash Count */}
                <KpiTile icon={<WashingMachine className="w-4 h-4" />} label="Loads (today)" value={String(kpi.todayTotalLoads)} />
                <KpiTile icon={<WashingMachine className="w-4 h-4" />} label="Washing (today)" value={String(kpi.todayWashCount)} />
              </CardContent>
            </Card>

            {/* Today's Financial Overview */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><IndianRupee className="w-5 h-5" /> Today's Financials</CardTitle>
                <CardDescription>Revenue and payment breakdown for today.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-4">
                <KpiTile icon={<IndianRupee className="w-4 h-4" />} label="Total Revenue" value={inr(kpi.revenue)} />
                <KpiTile icon={<IndianRupee className="w-4 h-4" />} label="Cash Payments" value={String(kpi.todayCashPayments)} />
                <KpiTile icon={<IndianRupee className="w-4 h-4" />} label="Online Payments" value={String(kpi.todayOnlinePayments)} />
                <KpiTile icon={<IndianRupee className="w-4 h-4" />} label="Pending Payments" value={String(kpi.todayPendingPayments)} />
                <KpiTile icon={<IndianRupee className="w-4 h-4" />} label="Membership Orders" value={String(kpi.todayMembershipCoveredOrders)} /> {/* New KPI for membership covered orders */}
              </CardContent>
            </Card>

            {/* Staff Load */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Staff Workload (Today)</CardTitle>
                <CardDescription>Orders assigned to each staff member.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                {Object.entries(kpi.staffLoad).map(([id, count]) => (
                  <div key={id} className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-2"><Users className="w-4 h-4" /><span className="text-sm">{demoStaff.find(s=>s.id===id)?.name} ({id})</span></div>
                    <div className="text-xl font-semibold">{count}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Monthly Customer Visits */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Monthly Customer Visits</CardTitle>
                <CardDescription>Top customers by visit count and total spend this month.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Visits</TableHead>
                      <TableHead className="text-right">Total Spend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpi.monthlyCustomerVisits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-neutral-500">No customer visits this month.</TableCell>
                      </TableRow>
                    ) : (
                      kpi.monthlyCustomerVisits.map((customer, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{customer.name} ({customer.phone})</TableCell>
                          <TableCell className="text-right">{customer.visits}</TableCell>
                          <TableCell className="text-right">{inr(customer.totalSpend)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Monthly Business Overview */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><IndianRupee className="w-5 h-5" /> Monthly Overview</CardTitle>
                <CardDescription>This month's total loads and revenue.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <KpiTile icon={<WashingMachine className="w-4 h-4" />} label="Total Loads (month)" value={String(kpi.monthlyTotalLoads)} />
                <KpiTile icon={<IndianRupee className="w-4 h-4" />} label="Total Revenue (month)" value={inr(kpi.monthlyTotalRevenue)} />
              </CardContent>
            </Card>

          </TabsContent>

          {/* ADMIN PANEL (settings, users, pricing) */}
          <TabsContent value="admin" className="grid md:grid-cols-3 gap-6">
            <Card className="self-start">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> User Management</CardTitle>
                <CardDescription>Add or deactivate staff/owner users.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {demoStaff.map(s => (
                  <div key={s.id} className="rounded-xl border p-3 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                      {/* Display "Staff - Name (ID)" */}
                      <Users className="w-4 h-4" />
                      <span className="font-medium">Staff - {s.name}</span>
                      <span className="text-xs text-neutral-500">({s.id})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="h-7 px-3 text-xs" onClick={() => console.log(`Reset PIN for ${s.name} (${s.id})`)}>Reset PIN</Button>
                      <Button variant="destructive" className="h-7 px-3 text-xs" onClick={() => console.log(`Deactivate user ${s.name} (${s.id})`)}>Deactivate</Button>
                    </div>
                  </div>
                ))}
                <Button className="rounded-2xl h-7 px-3 text-xs mt-2" onClick={() => console.log("Add New User clicked")}>Add New User</Button>
              </CardContent>
            </Card>

            {/* New Card for Holiday Management */}
            <Card className="self-start">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Holiday Management</CardTitle>
                <CardDescription>Set days when new orders cannot be placed.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="new-holiday-date">Add New Holiday</Label>
                  <div className="flex items-center gap-2">
                    <Input type="date" id="new-holiday-date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} />
                    <Button onClick={handleAddHoliday} disabled={!newHolidayDate}>Add</Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Current Holidays</Label>
                  {holidays.length === 0 ? (
                    <p className="text-sm text-neutral-500">No holidays set.</p>
                  ) : (
                    <ul className="list-disc list-inside">
                      {holidays.map(holiday => (
                        <li key={holiday} className="flex items-center justify-between text-sm py-1">
                          {holiday}
                          <Button variant="destructive" size="sm" className="h-6 px-2 text-xs" onClick={() => handleRemoveHoliday(holiday)}>Remove</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* New Card for Editing Membership Tiers - Moved here */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Edit Membership Tiers</CardTitle>
                <CardDescription>Adjust discount percentages for membership plans.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {Object.entries(MEMBERSHIP_LABELS).filter(([key]) => key !== 'none').map(([tier, label]) => (
                  <div key={tier} className="grid gap-2 rounded-xl border p-3 bg-white">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={(currentMembershipDiscounts[tier as MembershipType] * 100).toFixed(0)}
                        onChange={(e) => {
                          const newDiscount = Number(e.target.value) / 100;
                          setCurrentMembershipDiscounts(prev => ({
                            ...prev,
                            [tier as MembershipType]: newDiscount
                          }));
                        }}
                        className="w-24"
                      />
                      <span>% OFF</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Pricing & Services</CardTitle>
                <CardDescription>Control load types and base prices.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-2 rounded-xl border p-3 bg-white">
                  <Label>Normal Load (per {BASE_LOAD_WEIGHT_KG}kg load)</Label>
                  <div className="flex items-center gap-2">
                    <Input defaultValue={LOAD_PRICES.normal} type="number" min={100} step={10} className="w-32" />
                    <span>INR</span>
                    <Button size="sm" variant="outline">Update</Button>
                  </div>
                </div>
                <div className="grid gap-2 rounded-xl border p-3 bg-white">
                  <Label>Express Load (per {BASE_LOAD_WEIGHT_KG}kg load, 1 hour)</Label>
                  <div className="flex items-center gap-2">
                    <Input defaultValue={LOAD_PRICES.express} type="number" min={100} step={10} className="w-32" />
                    <span>INR</span>
                    <Button size="sm" variant="outline">Update</Button>
                  </div>
                </div>
                <div className="grid gap-2 rounded-xl border p-3 bg-white">
                  <Label>Express SLA (minutes)</Label>
                  <div className="flex items-center gap-2">
                    <Input defaultValue={60} type="number" min={30} step={5} className="w-32" />
                    <Button size="sm" variant="outline">Update</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NEW MEMBERSHIP PANEL */}
          <TabsContent value="membership" className="grid md:grid-cols-2 gap-6"> {/* Changed grid-cols to 2 for better layout */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Membership Loads Overview</CardTitle>
                <CardDescription>Total loads processed under membership plans.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <KpiTile icon={<WashingMachine className="w-4 h-4" />} label="Total Member Loads (All Time)" value={String(kpi.totalMemberLoads)} />
                <KpiTile icon={<WashingMachine className="w-4 h-4" />} label="Today's Member Loads" value={String(kpi.todayMembershipLoads)} /> {/* New KPI Tile */}
                <div className="grid gap-2">
                  <Label className="text-sm">Loads by Tier (Normal Loads Only)</Label>
                  {Object.entries(kpi.memberLoadsByTier).length === 0 ? (
                    <p className="text-sm text-neutral-500">No membership loads recorded yet.</p>
                  ) : (
                    <ul className="list-disc list-inside">
                      {Object.entries(kpi.memberLoadsByTier).map(([tier, loads]) => (
                        <li key={tier} className="flex items-center justify-between text-sm py-1">
                          <span className="font-medium">{MEMBERSHIP_LABELS[tier as MembershipType]}</span>
                          <span className="text-right">{loads} loads</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* New Card for Detailed Membership Orders */}
            <Card className="md:col-span-2"> {/* Span full width */}
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Detailed Membership Orders</CardTitle>
                <CardDescription>All orders covered by membership plans.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Loads</TableHead>
                      <TableHead>Membership</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpi.allMembershipOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-neutral-500">No membership orders found.</TableCell>
                      </TableRow>
                    ) : (
                      kpi.allMembershipOrders.map(o => (
                        <TableRow key={o.token} >
                          {/* Displaying the full token now */}
                          <TableCell className="font-medium">{o.token}</TableCell>
                          <TableCell>{o.name}</TableCell>
                          <TableCell>{o.phone}</TableCell>
                          <TableCell>{o.loads}</TableCell>
                          <TableCell>{MEMBERSHIP_LABELS[o.membership]}</TableCell>
                          <TableCell className="text-right">{inr(o.price)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="pb-10 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} Hi5 Laundromat • Wash • Dry • Fold • Madhapur, Hyderabad • Contact: 9876543210
        </footer>
      </main>
    </div>
  );
}

function KpiTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">{label}</span>
        <div className="opacity-70">{icon}</div>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function OrderForm({ onCreate, holidays, currentMembershipDiscounts }: { onCreate: (o: Order)=>void; holidays: string[]; currentMembershipDiscounts: Record<MembershipType, number> }) {
  const [numericTokenInput, setNumericTokenInput] = useState(""); // Changed state name
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [weight, setWeight] = useState(6); // Default to 6kg for 1 load
  const [blankets, setBlankets] = useState(false); // State for blankets, kept for type but removed from UI
  const [type, setType] = useState<"normal"|"express">("normal");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash"); // New state for payment method
  const [membership, setMembership] = useState<MembershipType>("none"); // New state for membership
  const [submitting, setSubmitting] = useState(false);

  // Check if today is a holiday
  const isTodayHoliday = useMemo(() => isHoliday(Date.now(), holidays), [holidays]);

  // Calculate loads and price dynamically based on weight, type, and membership
  const { loads, price } = useMemo(() => calculateOrderDetails(weight, type, membership, currentMembershipDiscounts), [weight, type, membership, currentMembershipDiscounts]);

  // Effect to update payment method based on membership and type
  useEffect(() => {
    if (membership !== 'none' && type === 'normal') {
      setPaymentMethod('membership_covered');
    } else if (paymentMethod === 'membership_covered') {
      // If membership is removed or type changes to express, reset payment method to cash
      setPaymentMethod('cash');
    }
  }, [membership, type, paymentMethod]);


  function reset() {
    setNumericTokenInput(""); // Reset numeric token input
    setName(""); setPhone(""); setWeight(6); setBlankets(false); setType("normal"); setPaymentMethod("cash");
    setMembership("none"); // Reset membership
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // Construct the full token with "HI5-" prefix
    const orderToken = `HI5-${numericTokenInput}`;
    const createdAt = Date.now();
    const dueAt = type === "express" ? createdAt + 60*60000 : undefined;
    
    // Assign a random staffId for new orders
    const staffId = demoStaff[Math.floor(Math.random() * demoStaff.length)].id;

    const order: Order = { token: orderToken, name, phone, weight, loads, blankets, type, price, createdAt, dueAt, stage: "received", paymentMethod, staffId, membership }; // Include membership
    await new Promise(r=>setTimeout(r, 500)); // Simulate API call
    onCreate(order);
    setSubmitting(false);
    reset();
  }

  return (
    <Card>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" /> Place Order</CardTitle>
          <CardDescription>{UI.noteBlanket}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Token (Numbers Only)</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={numericTokenInput}
                onChange={e => setNumericTokenInput(e.target.value)}
                required
                placeholder="e.g., 1234"
              />
            </div>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={e => {
                  // Filter out non-alphabetic characters and numbers in real-time
                  const filteredValue = e.target.value.replace(/[^A-Za-z\s]/g, '');
                  setName(filteredValue);
                }}
                required
                placeholder="e.g., Rohan"
                title="Only alphabetic characters and spaces are allowed"
              />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={e=>setPhone(e.target.value)} required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10-digit mobile" />
            </div>
            <div className="grid gap-2">
              <Label>Weight (kg)</Label>
              <Input type="number" min={1} max={60} step={0.1} value={weight} onChange={e=>setWeight(Number(e.target.value))} />
              <span className="text-xs text-neutral-500">
                Max 60kg. Automatically calculated as {loads} load{loads === 1 ? '' : 's'} (approx. {BASE_LOAD_WEIGHT_KG}kg per load).
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="grid gap-1">
                <Label>Service type</Label>
                <Select value={type} onValueChange={(v)=> setType(v as "normal"|"express")}>
                  <SelectTrigger className="w-[260px]"><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">{SERVICE_LABEL.normal}</SelectItem>
                    <SelectItem value="express">{SERVICE_LABEL.express}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-500">Total</div>
                <div className="text-2xl font-semibold">{inr(price)}</div>
              </div>
            </div>
            {/* New membership selection */}
            <div className="grid gap-2">
              <Label>Membership Plan</Label>
              <Select value={membership} onValueChange={(v) => setMembership(v as MembershipType)}>
                <SelectTrigger className="w-[260px]"><SelectValue placeholder="No Membership" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MEMBERSHIP_LABELS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {membership !== 'none' && type === 'express' && (
                <p className="text-xs text-red-500 mt-1">Membership discount not valid on Express Loads.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} disabled={membership !== 'none' && type === 'normal'}> {/* Disabled if membership is active and normal load */}
                <SelectTrigger className="w-[260px]"><SelectValue placeholder="Select payment method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="pending">Payment Pending</SelectItem>
                  {membership !== 'none' && type === 'normal' && (
                    <SelectItem value="membership_covered">Membership Covered</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting || isTodayHoliday} className="rounded-2xl px-5"> {/* Disable if holiday */}
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</> : "Submit"}
              </Button>
              <Button type="button" variant="outline" onClick={reset}>Reset</Button>
            </div>
            {isTodayHoliday && (
              <Alert variant="destructive">
                <AlertTitle>Holiday!</AlertTitle>
                <AlertDescription>New orders cannot be placed on holidays.</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </motion.div>
    </Card>
  );
}

function OrderTable({ orders, staffMode, onAdvance }: { orders: Order[]; staffMode?: boolean; onAdvance: (token: string)=>void; }) {
  const rows = [...orders].sort((a,b)=> b.createdAt - a.createdAt);

  function dueBadge(o: Order) {
    if (o.type !== "express") return null;
    const now = Date.now();
    const due = o.dueAt || now;
    const mins = minutes(due - now);

    if (mins < 0) return <Badge variant="destructive" className="bg-red-500 text-white">SLA breached</Badge>; // Red for breached
    if (mins <= 10) return <Badge className="bg-orange-500 text-white">Due soon ({mins}m left)</Badge>; // Orange for due soon
    return <Badge variant="secondary">{mins}m left</Badge>;
  }

  function getStatusBadgeClass(stage: OrderStage) {
    switch (stage) {
      case "ready": return "bg-green-500 text-white"; // Green for Ready
      case "wash":
      case "dry":
      case "fold": return "bg-blue-500 text-white"; // Blue for In Progress
      case "received": return "bg-gray-500 text-white"; // Gray for Received
      case "picked_up": return "bg-emerald-700 text-white"; // Darker green for picked up
      default: return "bg-gray-500 text-white";
    }
  }

  // Function to get payment method badge class
  function getPaymentBadgeClass(paymentMethod: PaymentMethod) {
    switch (paymentMethod) {
      case "pending": return "bg-red-500 text-white";
      case "membership_covered": return "bg-purple-600 text-white"; // Distinct color for membership covered
      default: return "bg-gray-500 text-white";
    }
  }

  // Function to calculate pending time
  function getPendingTime(createdAt: number) {
    const now = Date.now();
    const diffMs = now - createdAt;
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const seconds = Math.floor((diffMs % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else if (remainingMinutes > 0) {
      return `${remainingMinutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <Table>
        <thead>
          <TableRow>
            <TableHead>Token</TableHead>
            <TableHead>Created</TableHead>
            {staffMode && <TableHead>Pending Time</TableHead>}
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>₹</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Membership</TableHead> {/* New TableHead for Membership */}
            {staffMode && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={staffMode ? 9 : 7} className="text-center text-neutral-500">No matching orders found.</TableCell>
            </TableRow>
          ) : (
            rows.map(o => (
              <TableRow key={o.token} >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{o.token}</Badge>
                    {o.type === "express" && <Badge><Zap className="w-3 h-3 mr-1" /> Express</Badge>}
                  </div>
                  {/* Display customer name and phone number */}
                  <div className="text-xs text-neutral-500">{o.name} • {o.phone}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">{new Date(o.createdAt).toLocaleTimeString()}</TableCell>
                {staffMode && <TableCell className="whitespace-nowrap text-xs">{getPendingTime(o.createdAt)}</TableCell>}
                <TableCell className="text-xs">
                  {o.type === "normal" ? SERVICE_LABEL.normal : SERVICE_LABEL.express}
                  <br />
                  <span className="text-neutral-500">{o.weight} kg ({o.loads} load{o.loads === 1 ? '' : 's'})</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusBadgeClass(o.stage)}>{stageLabel(o.stage)}</Badge>
                    {dueBadge(o)}
                  </div>
                </TableCell>
                <TableCell className="font-semibold">{inr(o.price)}</TableCell>
                <TableCell className="text-xs">
                  {o.paymentMethod === 'cash' || o.paymentMethod === 'online' ? (
                    o.paymentMethod
                  ) : (
                    <Badge className={getPaymentBadgeClass(o.paymentMethod)}>{o.paymentMethod === 'pending' ? 'Pending' : 'Covered'}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {MEMBERSHIP_LABELS[o.membership]} {/* Display membership */}
                </TableCell>
                {staffMode && ( // Conditionally render Actions cell
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => onAdvance(o.token)}
                      disabled={o.stage === "picked_up"} // Disable if already picked up
                    >
                      {o.stage === "received" ? "Start" : (o.stage === "ready" ? "Mark Picked Up" : (o.stage === "picked_up" ? "Completed" : "Next stage"))}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
