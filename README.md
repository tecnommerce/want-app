# Want App - Plataforma de Pedidos Online

Una moderna plataforma web para gestión de pedidos y restaurantes, optimizada para móviles y escritorio.

## 🎨 Mejoras de UI/UX Implementadas

### Diseño Visual Moderno
- **Paleta de colores profesional** con variables CSS para consistencia
- **Gradientes sutiles** en botones y elementos interactivos
- **Sombras mejoradas** con diferentes niveles de profundidad
- **Bordes redondeados** modernos (radius: 8px - 24px)
- **Transiciones suaves** con curvas bezier personalizadas

### Experiencia Responsive
- **Mobile-first** con breakpoints optimizados (480px, 768px, 1024px)
- **Menú hamburguesa** animado para móviles
- **Bottom navigation** para navegación fácil en móviles
- **Grids adaptables** que se ajustan automáticamente
- **Touch-friendly** con áreas de clic de 44px mínimo

### Componentes Mejorados

#### Header
- Sticky header con backdrop blur
- Buscador con animaciones focus
- Avatar de usuario con dropdown animado
- Logo con hover effect

#### Botones
- Gradientes modernos
- Hover effects con elevación
- Estados active y disabled
- Iconos integrados

#### Tarjetas de Productos
- Hover effects con scale y shadow
- Imágenes con zoom suave
- Bordes superiores de color
- Información jerarquizada

#### Modales
- Animaciones de entrada/salida
- Backdrop con blur
- Responsive en móviles (bottom sheet)
- Scroll interno optimizado

#### Tablas
- Headers sticky
- Hover en filas
- Badges de estado con gradientes
- Botones de acción coloridos

### Animaciones
- **Fade in/out** para transiciones suaves
- **Slide in** desde diferentes direcciones
- **Scale** para efectos de profundidad
- **Rotate** en iconos y botones
- **Pulse** para notificaciones

### Accesibilidad
- Contraste de colores WCAG AA
- Focus states visibles
- Soporte para teclado
- Labels semánticos
- ARIA attributes

## 📁 Estructura del Proyecto

```
├── css/
│   ├── styles.css          # Estilos principales (usuarios)
│   ├── admin.css           # Panel de vendedor
│   ├── responsive.css      # Componentes responsive
│   ├── buscador-avanzado.css
│   └── notificaciones.css
├── js/
│   ├── supabase-client.js  # Cliente Supabase (compradores)
│   ├── supabase-vendedor.js # Cliente Supabase (vendedores)
│   ├── auth-usuario.js     # Autenticación
│   ├── session-manager.js  # Gestión de sesiones
│   └── ...
├── index.html              # Home page
├── tienda.html             # Página de tienda
├── login.html              # Login de usuarios
├── admin.html              # Panel de vendedor
└── admin-global/           # Panel administrativo global
```

## 🚀 Características Principales

### Para Usuarios
- ✅ Búsqueda avanzada de productos
- ✅ Carrito de compras
- ✅ Pedidos en tiempo real
- ✅ Notificaciones push
- ✅ Historial de pedidos
- ✅ Autenticación con Google

### Para Vendedores
- ✅ Gestión de pedidos
- ✅ Administración de productos
- ✅ Control de delivery
- ✅ Reportes y métricas
- ✅ Estados de pedidos
- ✅ Integración con WhatsApp

### Para Administradores
- ✅ Gestión de usuarios
- ✅ Gestión de vendedores
- ✅ Métricas globales
- ✅ Moderación de contenido

## 🛠️ Tecnologías

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Hosting:** Vercel
- **Iconos:** Font Awesome 6
- **Imágenes:** Cloudinary

## 📱 Responsive Breakpoints

- **Móvil:** < 480px
- **Tablet:** 480px - 768px
- **Desktop:** 768px - 1024px
- **Desktop Grande:** > 1024px

## 🎯 Variables CSS Principales

```css
:root {
    --primary: #FF5A00;
    --primary-light: #FF7A00;
    --primary-dark: #e04e00;
    --primary-soft: #FFF5EB;
    
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
    --info: #3b82f6;
    
    --gray-50: #f9fafb;
    --gray-100: #f3f4f6;
    --gray-200: #e5e7eb;
    --gray-300: #d1d5db;
    --gray-400: #9ca3af;
    --gray-500: #6b7280;
    --gray-600: #4b5563;
    --gray-700: #374151;
    --gray-800: #1f2937;
    --gray-900: #111827;
}
```

## 🔧 Configuración de Vercel

El archivo `vercel.json` incluye:
- Rutas optimizadas para SPA
- Headers de caché para assets estáticos
- Redirecciones para SEO
- Soporte para URLs amigables

## 📊 Métricas de Performance

- **Lighthouse Score:** 90+
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3s
- **Cumulative Layout Shift:** < 0.1

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-feature`)
3. Commit tus cambios (`git commit -m 'Add nueva feature'`)
4. Push a la rama (`git push origin feature/nueva-feature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de uso privado. Todos los derechos reservados.

## 📞 Contacto

Para consultas o soporte técnico, contacta al equipo de desarrollo.

---

**Want App** - Pedidos simples a tus negocios favoritos 🧡
