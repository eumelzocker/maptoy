export interface MenuItem {
  id: string;
  label: string;
  title?: string;
  icon?: string;
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean;
  children?: readonly MenuItem[];
}
