import SalarySchemeForm from "@/components/salary/SalarySchemeForm"

export default async function SalarySchemePage({ params }: { params: Promise<{ clubId: string, schemeId: string }> }) {
    const { clubId, schemeId } = await params

    return (
        <div className="p-8">
            <SalarySchemeForm clubId={clubId} schemeId={schemeId} />
        </div>
    )
}
