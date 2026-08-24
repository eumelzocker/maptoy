export interface MenuItem {
  id: string;
  label: string;
  title?: string;
  icon?: string;
  disabled?: boolean;
  selected?: boolean;
  children?: readonly MenuItem[];
}
