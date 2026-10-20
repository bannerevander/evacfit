import { Accessibility, AlertOctagon, Building2, ClipboardList, ClipboardPlus, House, LayoutDashboard, LogIn, ShieldCheck, Truck, Users } from 'lucide-react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AreaContext, ShelterContext, VolunteerContext } from './components/Context'
import { Gate } from './components/Gate'
import { CitizenLayout, StaffLayout, type NavItem } from './components/Layout'
import Home from './pages/Home'
import { KoordinatorBacklog, KoordinatorKomando, KoordinatorPenugasan, KoordinatorPosko } from './pages/Koordinator'
import { PoskoFasilitas, PoskoKedatangan, PoskoRekomendasi } from './pages/Posko'
import { RelawanTriage, RelawanTugas } from './pages/Relawan'
import { WargaBaru, WargaHome, WargaKebutuhan, WargaKeluarga, WargaUbah } from './pages/Warga'
import { dataMode } from './state/remote'
import { StoreProvider } from './state/store'

const citizen: NavItem[] = [
  { to: '/warga', label: (d) => d.nav.home, icon: House, end: true },
  { to: '/warga/kebutuhan', label: (d) => d.nav.needs, icon: Accessibility },
  { to: '/warga/keluarga', label: (d) => d.nav.family, icon: Users },
]

const coordinator: NavItem[] = [
  { to: '/koordinator', label: (d) => d.nav.command, icon: LayoutDashboard, end: true },
  { to: '/koordinator/penugasan', label: (d) => d.nav.dispatch, icon: Truck, count: (s) => s.assignments.filter((a) => a.status === 'confirmed' && !a.volunteerId).length },
  { to: '/koordinator/backlog', label: (d) => d.nav.backlog, icon: AlertOctagon, count: (s) => s.unmet.filter((u) => u.resolutionStatus === 'open').length },
  { to: '/koordinator/posko', label: (d) => d.nav.shelters, icon: ShieldCheck },
]

// Counts are for the shelter on duty: unanswered recommendations expire after 15 minutes, so they must not be missed.
const shelter: NavItem[] = [
  { to: '/posko', label: (d) => d.nav.incoming, icon: ClipboardList, end: true, count: (s) => s.assignments.filter((a) => a.status === 'recommended' && a.shelterId === s.persona.shelter).length },
  { to: '/posko/kedatangan', label: (d) => d.nav.checkin, icon: LogIn },
  { to: '/posko/fasilitas', label: (d) => d.nav.facilities, icon: Building2 },
]

const field: NavItem[] = [
  { to: '/relawan', label: (d) => d.nav.tasks, icon: Truck, end: true, count: (s) => s.assignments.filter((a) => a.status === 'confirmed' && !!a.volunteerId).length },
  { to: '/relawan/triage', label: (d) => d.nav.triage, icon: ClipboardPlus },
]

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route index element={<Home />} />
          <Route path="warga" element={<Gate role="citizen"><CitizenLayout items={citizen} /></Gate>}>
            <Route index element={<WargaHome />} />
            <Route path="kebutuhan" element={<WargaKebutuhan />} />
            <Route path="kebutuhan/ubah" element={<WargaUbah />} />
            <Route path="keluarga" element={<WargaKeluarga />} />
            <Route path="keluarga/baru" element={<WargaBaru />} />
          </Route>
          <Route path="koordinator" element={<Gate role="coordinator"><StaffLayout items={coordinator} role="coordinator" context={dataMode === 'supabase' ? <AreaContext /> : undefined} showAlerts /></Gate>}>
            <Route index element={<KoordinatorKomando />} />
            <Route path="penugasan" element={<KoordinatorPenugasan />} />
            <Route path="backlog" element={<KoordinatorBacklog />} />
            <Route path="posko" element={<KoordinatorPosko />} />
          </Route>
          <Route path="posko" element={<Gate role="shelter_manager"><StaffLayout items={shelter} role="shelter" context={<AreaContext><ShelterContext /></AreaContext>} showAlerts /></Gate>}>
            <Route index element={<PoskoRekomendasi />} />
            <Route path="kedatangan" element={<PoskoKedatangan />} />
            <Route path="fasilitas" element={<PoskoFasilitas />} />
          </Route>
          <Route path="relawan" element={<Gate role="volunteer"><StaffLayout items={field} role="field" context={<AreaContext><VolunteerContext /></AreaContext>} /></Gate>}>
            <Route index element={<RelawanTugas />} />
            <Route path="triage" element={<RelawanTriage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
