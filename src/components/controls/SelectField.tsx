type SelectFieldProps = {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
};

const SelectField = ({ label, htmlFor, children }: SelectFieldProps) => {
  return (
    <div>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
};

export default SelectField;
