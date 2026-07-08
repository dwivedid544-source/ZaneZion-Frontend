const BootstrapPagination = (props) => {
    const {
        // New props
        activePage, itemsCountPerPage = 10, totalItemsCount, onChange,
        // Old pattern 1: pagination={obj} onPageChange={fn}
        pagination, onPageChange,
        // Old pattern 2: currentPage, totalPages, totalItems, onPageChange
        currentPage, totalPages: totalPagesProp, totalItems
    } = props;

    // Resolve values from any prop pattern
    const page = activePage || pagination?.page || currentPage || 1;
    const perPage = itemsCountPerPage || pagination?.limit || 10;
    const total = totalItemsCount || pagination?.total || totalItems || 0;
    const totalPages = totalPagesProp || pagination?.totalPages || (total ? Math.ceil(total / perPage) : 1);
    const handleChange = onChange || onPageChange;

    if ((totalPages <= 1 && page <= 1) || !handleChange) return null;

    const pageRangeDisplayed = 5;
    const getPageNumbers = () => {
        const pages = [];
        let start = Math.max(1, page - Math.floor(pageRangeDisplayed / 2));
        let end = Math.min(totalPages, start + pageRangeDisplayed - 1);
        if (end - start + 1 < pageRangeDisplayed) {
            start = Math.max(1, end - pageRangeDisplayed + 1);
        }
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    };

    return (
        <nav className="flex justify-center mt-6">
            <ul className="pagination">
                <li className={page === 1 ? 'disabled' : ''}>
                    <button type="button" onClick={() => page > 1 && handleChange(1)}>&laquo;</button>
                </li>
                <li className={page === 1 ? 'disabled' : ''}>
                    <button type="button" onClick={() => page > 1 && handleChange(page - 1)}>&lsaquo;</button>
                </li>
                {getPageNumbers().map(num => (
                    <li key={num} className={page === num ? 'active' : ''}>
                        <button type="button" onClick={() => handleChange(num)}>{num}</button>
                    </li>
                ))}
                <li className={page === totalPages ? 'disabled' : ''}>
                    <button type="button" onClick={() => page < totalPages && handleChange(page + 1)}>&rsaquo;</button>
                </li>
                <li className={page === totalPages ? 'disabled' : ''}>
                    <button type="button" onClick={() => page < totalPages && handleChange(totalPages)}>&raquo;</button>
                </li>
            </ul>
        </nav>
    );
};

export default BootstrapPagination;
