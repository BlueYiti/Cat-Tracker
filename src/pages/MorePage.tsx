// More page: shortcuts to Expenses and Settings.

import { Link } from 'react-router-dom';
import { WalletIcon, SettingsIcon, ChevronRightIcon } from '../components/icons';

export function MorePage() {
  return (
    <>
      <div className="page-head">
        <h1>More</h1>
      </div>

      <nav className="menu-list" aria-label="More options">
        <Link to="/expenses" className="menu-item">
          <span className="menu-item__icon" aria-hidden="true">
            <WalletIcon size={20} />
          </span>
          <span className="menu-item__label">Expenses</span>
          <span className="menu-item__chevron" aria-hidden="true">
            <ChevronRightIcon size={18} />
          </span>
        </Link>
        <Link to="/settings" className="menu-item">
          <span className="menu-item__icon" aria-hidden="true">
            <SettingsIcon size={20} />
          </span>
          <span className="menu-item__label">Settings</span>
          <span className="menu-item__chevron" aria-hidden="true">
            <ChevronRightIcon size={18} />
          </span>
        </Link>
      </nav>

      <div className="card">
        <div className="row-item__sub">
          Cat Care Tracker — offline-first household tracker for cat food, litter, and expenses. All data stays on
          this device.
        </div>
      </div>
    </>
  );
}