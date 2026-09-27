
export default function BackgroundImage() {

    return (
        <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] dark:invert pointer-events-none"
            style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 0l40 40-40 40L0 40zM40 10l30 30-30 30L10 40z' fill='%23000000' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                backgroundSize: '60px 60px'
            }}
        />
    );
}