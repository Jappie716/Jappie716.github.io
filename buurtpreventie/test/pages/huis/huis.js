let draggedEmoji = "";

export function initHuis() {
    const draggables = document.querySelectorAll('.drag-obj');
    const canvas = document.getElementById('house-canvas');
    
    if (!canvas) return;
    
    draggables.forEach(obj => {
        if (obj.ondragstart) return;
        obj.ondragstart = (e) => {
            draggedEmoji = e.target.dataset.type;
        };
    });
    
    canvas.ondragover = (e) => e.preventDefault();
    canvas.ondrop = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - 20;
        const y = e.clientY - rect.top - 20;
        
        const el = document.createElement('div');
        el.className = 'placed-obj';
        el.innerText = draggedEmoji;
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.onclick = () => el.remove();
        canvas.appendChild(el);
    };
}