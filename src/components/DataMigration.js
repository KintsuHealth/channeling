import { useState, useEffect } from 'react';
import { useCoffees } from '@/lib/useCoffees';
import { useSettings } from '@/lib/useSettings';

export function DataMigration() {
  const [localData, setLocalData] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const { importCoffees, coffees } = useCoffees();
  const { setBaselineGrind } = useSettings();

  useEffect(() => {
    try {
      const storedCoffees = localStorage.getItem('coffee-inv');
      const storedBaseline = localStorage.getItem('coffee-baseline-grind');

      if (storedCoffees) {
        const coffeeData = JSON.parse(storedCoffees);
        if (Array.isArray(coffeeData) && coffeeData.length > 0) {
          setLocalData({
            coffees: coffeeData,
            baseline: storedBaseline ? JSON.parse(storedBaseline) : null,
          });
        }
      }
    } catch (e) {
      console.error('Error reading localStorage:', e);
    }
  }, []);

  const handleMigrate = async () => {
    if (!localData) return;

    setMigrating(true);
    try {
      const importResult = await importCoffees(localData.coffees);

      if (localData.baseline !== null) {
        await setBaselineGrind(localData.baseline);
      }

      setResult(importResult);

      if (importResult.imported > 0) {
        localStorage.removeItem('coffee-inv');
        localStorage.removeItem('coffee-baseline-grind');
        setLocalData(null);
      }
    } catch (e) {
      setResult({ imported: 0, errors: [{ error: e.message }] });
    } finally {
      setMigrating(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (!localData || dismissed || coffees.length > 0) return null;

  return (
    <div style={{
      padding: 16,
      background: '#FFF8E1',
      border: '1px solid #FFB300',
      borderRadius: 10,
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#F57C00',
        marginBottom: 8,
      }}>
        Local Data Found
      </div>

      {!result ? (
        <>
          <p style={{ fontSize: 13, color: '#5D4037', marginBottom: 12, lineHeight: 1.5 }}>
            You have <strong>{localData.coffees.length}</strong> coffee{localData.coffees.length !== 1 ? 's' : ''} saved in your browser.
            Would you like to import them to your account?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleMigrate}
              disabled={migrating}
              style={{
                flex: 1,
                padding: '10px 0',
                background: migrating ? '#BDBDBD' : '#F57C00',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                cursor: migrating ? 'wait' : 'pointer',
              }}
            >
              {migrating ? 'Importing...' : 'Import to Cloud'}
            </button>
            <button
              onClick={handleDismiss}
              disabled={migrating}
              style={{
                padding: '10px 16px',
                background: 'none',
                border: '1px solid #BDBDBD',
                borderRadius: 7,
                fontSize: 13,
                color: '#757575',
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
          </div>
        </>
      ) : (
        <div>
          {result.imported > 0 ? (
            <p style={{ fontSize: 13, color: '#2E7D32', marginBottom: 8 }}>
              Successfully imported {result.imported} coffee{result.imported !== 1 ? 's' : ''}!
            </p>
          ) : (
            <p style={{ fontSize: 13, color: '#C62828', marginBottom: 8 }}>
              No coffees were imported.
            </p>
          )}
          {result.errors?.length > 0 && (
            <div style={{ fontSize: 11, color: '#C62828' }}>
              {result.errors.length} error{result.errors.length !== 1 ? 's' : ''} occurred
            </div>
          )}
          <button
            onClick={() => setDismissed(true)}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              background: 'none',
              border: '1px solid #BDBDBD',
              borderRadius: 5,
              fontSize: 11,
              color: '#757575',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
