type SelectFieldProps = {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
};


const SelectField = ({ label, htmlFor, children }: SelectFieldProps) => {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={htmlFor} className="whitespace-nowrap mr-2 min-w-9">{label}</label>
      {children}
    </div>
  );
};

export default SelectField;
