import Swal from 'sweetalert2';

// Dark theme matching Zanezion UI
const swalTheme = {
    background: '#1a1a2e',
    color: '#fff',
    confirmButtonColor: '#C8A96A',
    cancelButtonColor: '#555',
    iconColor: '#C8A96A',
};

export const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    ...swalTheme,
});

// Success alert
export const swalSuccess = (title, text) => Swal.fire({
    icon: 'success',
    title,
    text,
    ...swalTheme,
});

// Error alert
export const swalError = (title, text) => Swal.fire({
    icon: 'error',
    title: title || 'Error',
    text,
    ...swalTheme,
});

// Warning alert
export const swalWarning = (title, text) => Swal.fire({
    icon: 'warning',
    title,
    text,
    ...swalTheme,
});

// Info alert
export const swalInfo = (title, text) => Swal.fire({
    icon: 'info',
    title,
    text,
    ...swalTheme,
});

// Confirm dialog (replaces window.confirm)
export const swalConfirm = (title, text, confirmText = 'Yes', cancelText = 'Cancel') => Swal.fire({
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    ...swalTheme,
});

// Credentials display (for showing login/password)
export const swalCredentials = (title, email, password, extra = '') => Swal.fire({
    icon: 'success',
    title,
    html: `
        <div style="text-align:left;font-size:14px;color:#ccc;">
            <p><strong style="color:#C8A96A;">Login:</strong> ${email}</p>
            <p><strong style="color:#C8A96A;">Password:</strong> ${password}</p>
            ${extra ? `<p style="margin-top:8px;color:#888;">${extra}</p>` : ''}
        </div>
    `,
    ...swalTheme,
});

// Copied toast
export const swalCopied = (text = 'Copied!') => Toast.fire({ icon: 'success', title: text });

// Loading alert with spinner
export const swalLoading = (title = 'Processing...', text = 'Booking your chauffeur, please wait...') => Swal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    showConfirmButton: false,
    didOpen: () => {
        Swal.showLoading();
    },
    ...swalTheme,
});

// Close active swal
export const swalClose = () => Swal.close();

export default Swal;
