
export const STORE_TEXT_CONTRAST = '#ffffff'; 
// Blanco sobre #B45309/ #003c86 cumple contraste AA 4.5:1.
// (El #FF9900 oficial de Amazon con blanco NO lo cumple: por eso el ámbar es más oscuro.)

export const STORE_CONFIG: Record<string, {color: string, label: string}> = {
    amazon: { color: '#B45309', label: 'Amazon' },
    steam: { color: '#003c86', label: 'Steam' },
}
